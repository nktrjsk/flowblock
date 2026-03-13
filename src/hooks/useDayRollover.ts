import { useEffect } from "react";
import * as Evolu from "@evolu/common";
import { evolu } from "../db/evolu";
import { TimeBlockId, TaskId } from "../db/schema";

const LAST_ROLLOVER_KEY = "flowblock_last_rollover";

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStartOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function runRollover() {
  const todayStr = getTodayStr();
  if (localStorage.getItem(LAST_ROLLOVER_KEY) === todayStr) return;

  const blocksQuery = evolu.createQuery((db) =>
    db
      .selectFrom("timeBlock")
      .select(["id", "task_id", "end"])
      .where("isDeleted", "is", null),
  );

  const tasksQuery = evolu.createQuery((db) =>
    db
      .selectFrom("task")
      .select(["id", "status"])
      .where("isDeleted", "is", null),
  );

  const [blocks, tasks] = await Promise.all([
    evolu.loadQuery(blocksQuery),
    evolu.loadQuery(tasksQuery),
  ]);

  const startOfToday = getStartOfToday();

  // Count future blocks per task (to not reset tasks that still have upcoming blocks)
  const taskFutureBlockCount = new Map<string, number>();
  for (const block of blocks) {
    if (!block.end || !block.task_id) continue;
    if (new Date(block.end) >= startOfToday) {
      const key = block.task_id as string;
      taskFutureBlockCount.set(key, (taskFutureBlockCount.get(key) ?? 0) + 1);
    }
  }

  const taskStatusMap = new Map(tasks.map((t) => [t.id as string, t.status]));

  for (const block of blocks) {
    if (!block.end) continue;
    if (new Date(block.end) >= startOfToday) continue; // not past

    // Soft-delete past time block
    evolu.update("timeBlock", {
      id: block.id as TimeBlockId,
      isDeleted: 1,
    });

    // Return task to inbox only if planned and has no future blocks left
    const taskId = block.task_id as string | null;
    if (!taskId) continue;
    const status = taskStatusMap.get(taskId);
    const hasFutureBlocks = (taskFutureBlockCount.get(taskId) ?? 0) > 0;
    if (status === "planned" && !hasFutureBlocks) {
      evolu.update("task", {
        id: block.task_id as TaskId,
        status: Evolu.NonEmptyString100.orThrow("inbox"),
      });
    }
  }

  localStorage.setItem(LAST_ROLLOVER_KEY, todayStr);
}

export function useDayRollover() {
  useEffect(() => {
    runRollover();

    // Re-run when tab becomes visible (catches midnight crossover)
    function handleVisibility() {
      if (!document.hidden) {
        localStorage.removeItem(LAST_ROLLOVER_KEY);
        runRollover();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
