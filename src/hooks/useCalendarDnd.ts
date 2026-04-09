import { useState, useEffect } from "react";
import {
  HOUR_HEIGHT_PX,
  SNAP_MINUTES,
  DRAG_DATA_KEY,
  DragPayload,
  isDragPayload,
  activeDrag,
} from "../constants";
import { isoToDayMinutes } from "../lib/time";
import { TimeBlockId, TaskId } from "../db/schema";
import { useEvolu } from "../db/evolu";
import { createTimeBlock, moveTimeBlock } from "../services/timeBlocks";
import { setTaskStatus } from "../services/tasks";

function snapMinutes(raw: number) {
  return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

type TBRow = { id: unknown; start: string | null; end: string | null; task_id: unknown; title: unknown };
type TaskRow = { id: unknown; title: unknown };

export interface PendingMove {
  dayIndex: number;
  startMinutes: number;
  durationMinutes: number;
  startIso: string;
}

export interface Ghost {
  dayIndex: number;
  startMinutes: number;
  durationMinutes: number;
}

interface Props {
  days: Date[];
  timeBlockRows: readonly TBRow[];
  taskRows: readonly TaskRow[];
  getDayColumnEl: (dayIndex: number) => HTMLElement | null;
}

export function useCalendarDnd({ days, timeBlockRows, taskRows, getDayColumnEl }: Props) {
  const { update } = useEvolu();
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [pendingMoves, setPendingMoves] = useState<Map<string, PendingMove>>(new Map());

  // Clear pending moves once Evolu subscription catches up
  useEffect(() => {
    if (pendingMoves.size === 0) return;
    setPendingMoves((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const [id, pending] of prev) {
        const block = timeBlockRows.find((b) => String(b.id) === id);
        if (block && block.start === pending.startIso) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [timeBlockRows]);

  function getMinutesFromEvent(e: React.DragEvent, colEl: HTMLElement) {
    const rect = colEl.getBoundingClientRect();
    return clamp(snapMinutes(((e.clientY - rect.top) / HOUR_HEIGHT_PX) * 60), 0, 24 * 60 - SNAP_MINUTES);
  }

  function handleDragOver(e: React.DragEvent, dayIndex: number) {
    if (!e.dataTransfer.types.includes(DRAG_DATA_KEY)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const colEl = getDayColumnEl(dayIndex);
    if (!colEl) return;
    const rawMinutes = getMinutesFromEvent(e, colEl);

    if (activeDrag.payload?.type === "task") {
      const overBlock = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-block='true']") ?? null;
      setGhost(overBlock ? null : { dayIndex, startMinutes: rawMinutes, durationMinutes: 60 });
      return;
    }

    let startMinutes = rawMinutes;
    let durationMinutes = 60;

    if (activeDrag.payload?.type === "timeblock") {
      const payload = activeDrag.payload;
      startMinutes = clamp(rawMinutes - payload.offsetMinutes, 0, 24 * 60 - SNAP_MINUTES);
      const block = timeBlockRows.find((b) => b.id === payload.timeBlockId);
      if (block?.start && block?.end) {
        durationMinutes = Math.max(SNAP_MINUTES, isoToDayMinutes(block.end, days[dayIndex]) - isoToDayMinutes(block.start, days[dayIndex]));
      }
    }

    setGhost({ dayIndex, startMinutes, durationMinutes });
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setGhost(null);
    }
  }

  function handleDrop(e: React.DragEvent, dayIndex: number) {
    e.preventDefault();
    setGhost(null);

    const raw = e.dataTransfer.getData(DRAG_DATA_KEY);
    if (!raw) return;
    let payload: DragPayload;
    try { const p = JSON.parse(raw); if (!isDragPayload(p)) return; payload = p; } catch { return; }

    const dayDate = days[dayIndex];
    const colEl = getDayColumnEl(dayIndex);
    if (!colEl) return;
    const rawMinutes = getMinutesFromEvent(e, colEl);

    if (payload.type === "task") {
      const task = taskRows.find((t) => t.id === payload.taskId);
      const targetBlockEl = (e.target as HTMLElement).closest("[data-block-id]") as HTMLElement | null;
      const targetBlockId = targetBlockEl?.dataset.blockId ?? null;

      if (targetBlockId) {
        update("timeBlock", {
          id: targetBlockId as unknown as TimeBlockId,
          task_id: payload.taskId as unknown as TaskId,
        });
      } else {
        const startMin = clamp(rawMinutes, 0, 24 * 60 - SNAP_MINUTES);
        const endMin = clamp(startMin + 60, SNAP_MINUTES, 24 * 60);
        createTimeBlock(dayDate, startMin, endMin, {
          taskId: payload.taskId as unknown as TaskId,
          title: task?.title ? String(task.title) : undefined,
        });
      }
      setTaskStatus(payload.taskId as unknown as TaskId, "planned");
    } else if (payload.type === "timeblock") {
      const block = timeBlockRows.find((b) => b.id === payload.timeBlockId);
      if (!block?.start || !block?.end) return;

      const blockDurationMinutes = (new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000;
      const newStartMinutes = clamp(rawMinutes - payload.offsetMinutes, 0, 24 * 60 - SNAP_MINUTES);
      const newEndMinutes = clamp(newStartMinutes + blockDurationMinutes, SNAP_MINUTES, 24 * 60);

      const newStartIso = moveTimeBlock(
        payload.timeBlockId as unknown as TimeBlockId,
        dayDate,
        newStartMinutes,
        newEndMinutes,
      );

      setPendingMoves((prev) => new Map(prev).set(String(payload.timeBlockId), {
        dayIndex,
        startMinutes: newStartMinutes,
        durationMinutes: newEndMinutes - newStartMinutes,
        startIso: newStartIso,
      }));
    }
  }

  return { ghost, pendingMoves, handleDragOver, handleDragLeave, handleDrop };
}
