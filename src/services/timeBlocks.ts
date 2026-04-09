import { evolu } from "../db/evolu";
import { TimeBlockId, TaskId } from "../db/schema";
import * as Evolu from "@evolu/common";
import { dayMinutesToIso } from "../lib/time";
import { setTaskStatus } from "./tasks";

export function createTimeBlock(
  dayDate: Date,
  startMin: number,
  endMin: number,
  opts?: { taskId?: TaskId | null; title?: string; priority?: string | null },
): { ok: true; id: TimeBlockId } | { ok: false } {
  const result = evolu.insert("timeBlock", {
    task_id: opts?.taskId ?? null,
    title: Evolu.NonEmptyString1000.orThrow(opts?.title ?? "Nový blok"),
    start: Evolu.NonEmptyString100.orThrow(dayMinutesToIso(dayDate, startMin)),
    end: Evolu.NonEmptyString100.orThrow(dayMinutesToIso(dayDate, endMin)),
    priority: opts?.priority ? Evolu.NonEmptyString100.orThrow(opts.priority) : null,
  });
  return result.ok ? { ok: true, id: result.value.id as TimeBlockId } : { ok: false };
}

/** Moves a timeBlock in time. Returns the new start ISO string (for optimistic UI). */
export function moveTimeBlock(
  id: TimeBlockId,
  dayDate: Date,
  startMin: number,
  endMin: number,
): string {
  const startIso = dayMinutesToIso(dayDate, startMin);
  evolu.update("timeBlock", {
    id,
    start: Evolu.NonEmptyString100.orThrow(startIso),
    end: Evolu.NonEmptyString100.orThrow(dayMinutesToIso(dayDate, endMin)),
  });
  return startIso;
}

/** Soft-deletes a timeBlock. Optionally resets a linked task back to inbox. */
export function deleteTimeBlock(
  id: TimeBlockId,
  opts?: { resetTaskId?: TaskId | null },
): void {
  evolu.update("timeBlock", { id, isDeleted: 1 });
  if (opts?.resetTaskId) setTaskStatus(opts.resetTaskId, "inbox");
}
