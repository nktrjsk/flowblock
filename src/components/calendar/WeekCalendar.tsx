import { useState, useRef, useEffect } from "react";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { TaskId, TimeBlockId } from "../../db/schema";
import {
  HOUR_HEIGHT_PX,
  SNAP_MINUTES,
  GRID_HEIGHT_PX,
  DRAG_DATA_KEY,
  DragPayload,
} from "../../constants";
import TimeBlockComponent from "./TimeBlock";
import ExternalEvent from "./ExternalEvent";
import DayCapacityBars from "./DayCapacityBars";
import * as Evolu from "@evolu/common";
import { useTimeFormat, formatMinutes } from "../../contexts/TimeFormatContext";

const TIME_COLUMN_WIDTH = 48; // px
const DAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface WeekCalendarProps {
  weekStart: Date;
}

function getDayDate(weekStart: Date, dayIndex: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

function isoToMinutes(iso: string, referenceDate: Date): number {
  const d = new Date(iso);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  const diff = d.getTime() - ref.getTime();
  return Math.round(diff / (1000 * 60));
}

function minutesToIso(date: Date, minutes: number): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d.toISOString();
}

function snapMinutes(rawMinutes: number): number {
  return Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getTodayIndex(weekStart: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    if (d.getTime() === today.getTime()) return i;
  }
  return -1;
}

export default function WeekCalendar({ weekStart }: WeekCalendarProps) {
  const { insert, update } = useEvolu();
  const { timeFormat } = useTimeFormat();
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [nowMinutes, setNowMinutes] = useState(getNowMinutes);
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(getNowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to current time on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nowTop = (getNowMinutes() / 60) * HOUR_HEIGHT_PX;
    el.scrollTop = nowTop - el.clientHeight / 2;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const timeBlocksQuery = evolu.createQuery((db) =>
    db
      .selectFrom("timeBlock")
      .select(["id", "task_id", "title", "start", "end", "priority"])
      .where("isDeleted", "is", null)
      .orderBy("start", "asc"),
  );

  const tasksQuery = evolu.createQuery((db) =>
    db
      .selectFrom("task")
      .select(["id", "title", "priority"])
      .where("isDeleted", "is", null),
  );

  const externalEventsQuery = evolu.createQuery((db) =>
    db
      .selectFrom("externalEvent")
      .select(["id", "calendar_id", "title", "start", "end", "is_all_day"])
      .where("isDeleted", "is", null)
      .orderBy("start", "asc"),
  );

  const timeBlockRows = useQuery(timeBlocksQuery);
  const taskRows = useQuery(tasksQuery);
  const externalEventRows = useQuery(externalEventsQuery);

  const taskMap = new Map(taskRows.map((t) => [t.id, t]));

  // Ghost state for drag-over preview
  const [ghost, setGhost] = useState<{
    dayIndex: number;
    startMinutes: number;
    durationMinutes: number;
  } | null>(null);

  // Live resize override for capacity bar updates
  const [resizeOverride, setResizeOverride] = useState<{
    id: string;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);

  function handleResizeChange(blockId: string, liveStart: number | null, liveEnd: number | null) {
    if (liveStart === null || liveEnd === null) {
      setResizeOverride(null);
    } else {
      setResizeOverride({ id: blockId, startMinutes: liveStart, endMinutes: liveEnd });
    }
  }

  // Current drag payload (used during dragover to calculate ghost duration)
  const dragPayloadRef = useRef<DragPayload | null>(null);

  function getMinutesFromEvent(
    e: React.DragEvent | React.MouseEvent,
    dayColumnEl: HTMLElement,
  ): number {
    const rect = dayColumnEl.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    return clamp(snapMinutes((offsetY / HOUR_HEIGHT_PX) * 60), 0, 24 * 60 - SNAP_MINUTES);
  }

  function getDayColumnEl(dayIndex: number): HTMLElement | null {
    return gridRef.current?.querySelector(`[data-day="${dayIndex}"]`) ?? null;
  }

  function handleDragOver(e: React.DragEvent, dayIndex: number) {
    if (!e.dataTransfer.types.includes(DRAG_DATA_KEY)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const colEl = getDayColumnEl(dayIndex);
    if (!colEl) return;
    const rawMinutes = getMinutesFromEvent(e, colEl);

    // Determine duration and offset
    let startMinutes = rawMinutes;
    let durationMinutes = 60;

    if (dragPayloadRef.current?.type === "timeblock") {
      const payload = dragPayloadRef.current;
      startMinutes = clamp(
        rawMinutes - payload.offsetMinutes,
        0,
        24 * 60 - SNAP_MINUTES,
      );
      // Find existing block duration
      const block = timeBlockRows.find((b) => b.id === payload.timeBlockId);
      if (block && block.start && block.end) {
        const dayDate = getDayDate(weekStart, dayIndex);
        const blockStart = isoToMinutes(block.start, dayDate);
        const blockEnd = isoToMinutes(block.end, dayDate);
        durationMinutes = Math.max(SNAP_MINUTES, blockEnd - blockStart);
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
    dragPayloadRef.current = null;

    const raw = e.dataTransfer.getData(DRAG_DATA_KEY);
    if (!raw) return;
    const payload: DragPayload = JSON.parse(raw);
    const dayDate = getDayDate(weekStart, dayIndex);

    const colEl = getDayColumnEl(dayIndex);
    if (!colEl) return;
    const rawMinutes = getMinutesFromEvent(e, colEl);

    if (payload.type === "task") {
      const startMinutes = clamp(rawMinutes, 0, 24 * 60 - SNAP_MINUTES);
      const endMinutes = clamp(startMinutes + 60, SNAP_MINUTES, 24 * 60);
      const task = taskRows.find((t) => t.id === payload.taskId);
      const title = (task?.title ?? null) ?? Evolu.NonEmptyString1000.orThrow("Nový blok");
      insert("timeBlock", {
        task_id: payload.taskId as unknown as TaskId,
        title,
        start: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, startMinutes)),
        end: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, endMinutes)),
      });
      update("task", {
        id: payload.taskId as unknown as TaskId,
        status: Evolu.NonEmptyString100.orThrow("planned"),
      });
    } else if (payload.type === "timeblock") {
      const block = timeBlockRows.find((b) => b.id === payload.timeBlockId);
      if (!block || !block.start || !block.end) return;

      // Find the day this block currently belongs to
      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);
      const blockDurationMs = blockEnd.getTime() - blockStart.getTime();
      const blockDurationMinutes = blockDurationMs / (1000 * 60);

      const newStartMinutes = clamp(
        rawMinutes - payload.offsetMinutes,
        0,
        24 * 60 - SNAP_MINUTES,
      );
      const newEndMinutes = clamp(
        newStartMinutes + blockDurationMinutes,
        SNAP_MINUTES,
        24 * 60,
      );

      update("timeBlock", {
        id: payload.timeBlockId as unknown as TimeBlockId,
        start: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, newStartMinutes)),
        end: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, newEndMinutes)),
      });
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    const raw = e.dataTransfer.getData(DRAG_DATA_KEY);
    if (raw) {
      try {
        dragPayloadRef.current = JSON.parse(raw);
      } catch {
        // noop
      }
    }
  }

  function getPlannedMinutesForDay(dayIndex: number): number {
    const dayDate = getDayDate(weekStart, dayIndex);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    let planned = timeBlockRows
      .filter((b) => {
        if (!b.start) return false;
        const s = new Date(b.start);
        return s >= dayStart && s <= dayEnd;
      })
      .reduce((sum, b) => {
        if (!b.start || !b.end) return sum;
        if (resizeOverride && String(b.id) === resizeOverride.id) {
          return sum + (resizeOverride.endMinutes - resizeOverride.startMinutes);
        }
        return sum + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000);
      }, 0);

    // Adjust for active drag ghost
    if (ghost) {
      if (ghost.dayIndex === dayIndex) {
        planned += ghost.durationMinutes;
      }
      if (dragPayloadRef.current?.type === "timeblock") {
        const origBlock = timeBlockRows.find((b) => b.id === (dragPayloadRef.current as { type: "timeblock"; timeBlockId: string }).timeBlockId);
        if (origBlock?.start && origBlock?.end) {
          const origS = new Date(origBlock.start);
          if (origS >= dayStart && origS <= dayEnd) {
            planned -= Math.round((new Date(origBlock.end).getTime() - new Date(origBlock.start).getTime()) / 60000);
          }
        }
      }
    }

    return Math.max(0, planned);
  }

  // Group timeblocks by day
  function getBlocksForDay(dayIndex: number) {
    const dayDate = getDayDate(weekStart, dayIndex);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    return timeBlockRows
      .filter((b) => {
        if (!b.start) return false;
        const s = new Date(b.start);
        return s >= dayStart && s <= dayEnd;
      })
      .map((b) => {
        const task = b.task_id ? taskMap.get(b.task_id) : null;
        const startMins = isoToMinutes(b.start ?? "", dayDate);
        const endMins = isoToMinutes(b.end ?? "", dayDate);
        return {
          ...b,
          priority: (b.priority ?? task?.priority) ?? null,
          taskTitle: task?.title ? String(task.title) : null,
          startMinutes: startMins,
          durationMinutes: Math.max(SNAP_MINUTES, endMins - startMins),
          dayDate,
        };
      });
  }

  function getExternalEventsForDay(dayIndex: number) {
    const dayDate = getDayDate(weekStart, dayIndex);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    return externalEventRows
      .filter((ev) => {
        if (!ev.start) return false;
        const s = new Date(ev.start);
        return s >= dayStart && s <= dayEnd;
      })
      .map((ev) => {
        const startMins = isoToMinutes(ev.start ?? "", dayDate);
        const endMins = isoToMinutes(ev.end ?? "", dayDate);
        return {
          ...ev,
          startMinutes: startMins,
          durationMinutes: Math.max(SNAP_MINUTES, endMins - startMins),
        };
      });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day header row */}
      <div className="flex shrink-0 border-b border-[#1a1a2e]/10">
        <div style={{ width: TIME_COLUMN_WIDTH }} className="shrink-0" />
        {DAY_LABELS.map((label, i) => {
          const dayDate = getDayDate(weekStart, i);
          const isToday = dayDate.getTime() === today.getTime();
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center pt-1.5 text-xs font-medium text-[#1a1a2e]/60"
            >
              <div className="mb-1">
                <span>{label}</span>
                <span
                  className={`ml-1 ${isToday ? "bg-[#1a1a2e] text-[#f5f0e8] rounded-full px-1.5 py-0.5" : ""}`}
                >
                  {dayDate.getDate()}
                </span>
              </div>
              <DayCapacityBars plannedMinutes={getPlannedMinutesForDay(i)} />
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          ref={gridRef}
          className="flex"
          style={{ height: GRID_HEIGHT_PX, minHeight: GRID_HEIGHT_PX }}
          onDragLeave={handleDragLeave}
          onDragEnter={handleDragEnter}
        >
          {/* Time labels column */}
          <div
            style={{ width: TIME_COLUMN_WIDTH }}
            className="shrink-0 relative border-r border-[#1a1a2e]/10"
          >
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ top: h * HOUR_HEIGHT_PX }}
                className="absolute w-full text-right pr-2"
              >
                <span className="text-[10px] text-[#1a1a2e]/30 leading-none -translate-y-1/2 inline-block">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAY_LABELS.map((_, dayIndex) => {
            const blocks = getBlocksForDay(dayIndex);
            const extEvents = getExternalEventsForDay(dayIndex);
            const isGhostDay = ghost?.dayIndex === dayIndex;
            const isTodayCol = dayIndex === getTodayIndex(weekStart);
            const nowTop = (nowMinutes / 60) * HOUR_HEIGHT_PX;

            return (
              <div
                key={dayIndex}
                data-day={dayIndex}
                className="flex-1 relative border-r border-[#1a1a2e]/10 last:border-r-0"
                onDragOver={(e) => handleDragOver(e, dayIndex)}
                onDrop={(e) => handleDrop(e, dayIndex)}
              >
                {/* Hour grid lines — strongest */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ top: h * HOUR_HEIGHT_PX, borderColor: "rgba(26,26,46,0.2)" }}
                    className="absolute inset-x-0 border-t"
                  />
                ))}
                {/* Sub-hour lines */}
                {HOURS.map((h) => (
                  <>
                    <div
                      key={`${h}-q1`}
                      style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.25, borderColor: "rgba(26,26,46,0.07)", borderStyle: "dotted" }}
                      className="absolute inset-x-0 border-t"
                    />
                    <div
                      key={`${h}-half`}
                      style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.5, borderColor: "rgba(26,26,46,0.12)", borderStyle: "dashed" }}
                      className="absolute inset-x-0 border-t"
                    />
                    <div
                      key={`${h}-q3`}
                      style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.75, borderColor: "rgba(26,26,46,0.07)", borderStyle: "dotted" }}
                      className="absolute inset-x-0 border-t"
                    />
                  </>
                ))}

                {/* Current time indicator */}
                {isTodayCol && (
                  <div
                    style={{ top: nowTop, zIndex: 15 }}
                    className="absolute inset-x-0 pointer-events-none flex items-center"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5 shadow-sm" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                )}

                {/* External events (dashed, below time blocks) */}
                {extEvents.map((ev) => (
                  <ExternalEvent
                    key={ev.id}
                    title={ev.title ?? ""}
                    startMinutes={ev.startMinutes}
                    durationMinutes={ev.durationMinutes}
                  />
                ))}

                {/* Time blocks */}
                {blocks.map((block) => (
                  <TimeBlockComponent
                    key={block.id}
                    id={block.id}
                    taskId={block.task_id ?? null}
                    title={block.title ?? ""}
                    priority={block.priority}
                    taskTitle={block.taskTitle}
                    startMinutes={block.startMinutes}
                    durationMinutes={block.durationMinutes}
                    dayDate={block.dayDate}
                    onResizeChange={handleResizeChange}
                  />
                ))}

                {/* Drag ghost */}
                {isGhostDay && ghost && (() => {
                  const tooltipOnLeft = dayIndex >= 5;
                  const endMin = ghost.startMinutes + ghost.durationMinutes;
                  const label = `${formatMinutes(ghost.startMinutes, timeFormat)}–${formatMinutes(endMin, timeFormat)}`;
                  return (
                    <div
                      style={{
                        position: "absolute",
                        top: (ghost.startMinutes / 60) * HOUR_HEIGHT_PX,
                        left: 2,
                        right: 2,
                        height: Math.max((ghost.durationMinutes / 60) * HOUR_HEIGHT_PX, 12),
                        pointerEvents: "none",
                        zIndex: 20,
                      }}
                      className={`border-2 border-dashed border-[#1a1a2e]/40 rounded-md bg-[#1a1a2e]/5 flex items-start ${tooltipOnLeft ? "justify-start" : "justify-end"}`}
                    >
                      <span className="text-[10px] text-[#1a1a2e]/50 bg-white/80 rounded px-1 py-0.5 m-0.5 leading-none whitespace-nowrap">
                        {label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
