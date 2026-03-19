import { useState, useRef, useEffect, Fragment } from "react";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { TaskId, TimeBlockId } from "../../db/schema";
import {
  HOUR_HEIGHT_PX,
  SNAP_MINUTES,
  GRID_HEIGHT_PX,
  DRAG_DATA_KEY,
  TRANSITION_BUFFER_KEY,
  DragPayload,
  isDragPayload,
} from "../../constants";
import TimeBlockComponent from "../calendar/TimeBlock";
import ExternalEvent from "../calendar/ExternalEvent";
import DayCapacityBars from "../calendar/DayCapacityBars";
import * as Evolu from "@evolu/common";
import { useTimeFormat, formatMinutes } from "../../contexts/TimeFormatContext";
import { useTheme } from "../../contexts/ThemeContext";

const TIME_COLUMN_WIDTH = 48; // px
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Local utility functions (copied from WeekCalendar)
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

export default function TwoDayCalendar() {
  const { insert, update } = useEvolu();
  const { timeFormat } = useTimeFormat();
  const { effectiveTheme } = useTheme();
  const ink = effectiveTheme === "dark" ? "245,240,232" : "26,26,46";
  const gridHour    = `rgba(${ink},0.20)`;
  const gridHalf    = `rgba(${ink},0.12)`;
  const gridQuarter = `rgba(${ink},0.07)`;
  const [bufferMinutes, setBufferMinutes] = useState<number>(
    () => parseInt(localStorage.getItem(TRANSITION_BUFFER_KEY) ?? "0", 10) || 0,
  );
  // Re-read buffer if localStorage changes (settings modal saves it directly)
  useEffect(() => {
    const onStorage = () => {
      setBufferMinutes(parseInt(localStorage.getItem(TRANSITION_BUFFER_KEY) ?? "0", 10) || 0);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const days = [today, tomorrow];
  const dayLabels = ["Dnes", "Zítra"];

  const timeBlockRows = useQuery(timeBlocksQuery);
  const taskRows = useQuery(tasksQuery);
  const externalEventRows = useQuery(externalEventsQuery);
  const taskMap = new Map(taskRows.map((t) => [t.id, t]));

  const [ghost, setGhost] = useState<{
    dayIndex: number;
    startMinutes: number;
    durationMinutes: number;
  } | null>(null);

  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [newBlockDrag, setNewBlockDrag] = useState<{
    dayIndex: number;
    anchorMinutes: number;
    currentMinutes: number;
  } | null>(null);
  const lastClickRef = useRef<{ time: number; dayIndex: number; minutes: number } | null>(null);

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

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!newBlockDrag) return;
      const colEl = getDayColumnEl(newBlockDrag.dayIndex);
      if (!colEl) return;
      const rect = colEl.getBoundingClientRect();
      const minutes = clamp(snapMinutes(((e.clientY - rect.top) / HOUR_HEIGHT_PX) * 60), 0, 24 * 60 - SNAP_MINUTES);
      setNewBlockDrag((prev) => prev ? { ...prev, currentMinutes: minutes } : null);
    }

    function onMouseUp() {
      if (!newBlockDrag) return;
      const drag = newBlockDrag;
      setNewBlockDrag(null);

      const startMinutes = Math.min(drag.anchorMinutes, drag.currentMinutes);
      const rawDuration = Math.abs(drag.currentMinutes - drag.anchorMinutes);
      const durationMinutes = rawDuration < SNAP_MINUTES ? 60 : rawDuration;
      const endMinutes = Math.min(startMinutes + durationMinutes, 24 * 60);

      const dayDate = days[drag.dayIndex];
      const result = insert("timeBlock", {
        task_id: null,
        title: Evolu.NonEmptyString1000.orThrow("Nový blok"),
        start: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, startMinutes)),
        end: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, endMinutes)),
        priority: null,
      });
      if (result.ok) {
        setPendingOpenId(String(result.value.id));
        setTimeout(() => setPendingOpenId(null), 500);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBlockDrag]);

  function handleColMouseDown(e: React.MouseEvent, dayIndex: number) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-block],[data-popover]")) return;
    const colEl = getDayColumnEl(dayIndex);
    if (!colEl) return;
    const minutes = clamp(snapMinutes(((e.clientY - colEl.getBoundingClientRect().top) / HOUR_HEIGHT_PX) * 60), 0, 24 * 60 - SNAP_MINUTES);

    const now = Date.now();
    const last = lastClickRef.current;
    if (last && (now - last.time) < 400 && last.dayIndex === dayIndex && Math.abs(last.minutes - minutes) <= SNAP_MINUTES) {
      lastClickRef.current = null;
      e.preventDefault();
      setNewBlockDrag({ dayIndex, anchorMinutes: minutes, currentMinutes: minutes });
    } else {
      lastClickRef.current = { time: now, dayIndex, minutes };
    }
  }

  const newBlockGhost = newBlockDrag
    ? {
        dayIndex: newBlockDrag.dayIndex,
        startMinutes: Math.min(newBlockDrag.anchorMinutes, newBlockDrag.currentMinutes),
        durationMinutes: Math.max(SNAP_MINUTES, Math.abs(newBlockDrag.currentMinutes - newBlockDrag.anchorMinutes)),
      }
    : null;

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

    let startMinutes = rawMinutes;
    let durationMinutes = 60;

    if (dragPayloadRef.current?.type === "timeblock") {
      const payload = dragPayloadRef.current;
      startMinutes = clamp(rawMinutes - payload.offsetMinutes, 0, 24 * 60 - SNAP_MINUTES);
      const block = timeBlockRows.find((b) => b.id === payload.timeBlockId);
      if (block && block.start && block.end) {
        const dayDate = days[dayIndex];
        const blockStart = isoToMinutes(block.start, dayDate);
        const blockEnd = isoToMinutes(block.end, dayDate);
        durationMinutes = Math.max(SNAP_MINUTES, blockEnd - blockStart);
      }
    }

    startMinutes = adjustForBuffer(dayIndex, startMinutes, durationMinutes);
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
    let payload: DragPayload;
    try { const p = JSON.parse(raw); if (!isDragPayload(p)) return; payload = p; } catch { return; }
    const dayDate = days[dayIndex];

    const colEl = getDayColumnEl(dayIndex);
    if (!colEl) return;
    const rawMinutes = getMinutesFromEvent(e, colEl);

    if (payload.type === "task") {
      const startMinutes = adjustForBuffer(dayIndex, clamp(rawMinutes, 0, 24 * 60 - SNAP_MINUTES), 60);
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

      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);
      const blockDurationMinutes = (blockEnd.getTime() - blockStart.getTime()) / (1000 * 60);

      const rawStart = clamp(rawMinutes - payload.offsetMinutes, 0, 24 * 60 - SNAP_MINUTES);
      const newStartMinutes = adjustForBuffer(dayIndex, rawStart, blockDurationMinutes);
      const newEndMinutes = clamp(newStartMinutes + blockDurationMinutes, SNAP_MINUTES, 24 * 60);

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
        const p = JSON.parse(raw);
        if (isDragPayload(p)) dragPayloadRef.current = p;
      } catch {
        // noop
      }
    }
  }

  function getPlannedMinutesForDay(dayIndex: number): number {
    const dayDate = days[dayIndex];
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

  function getBlocksForDay(dayIndex: number) {
    const dayDate = days[dayIndex];
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

  function getBufferZones(dayIndex: number): Array<{ start: number; end: number }> {
    if (bufferMinutes === 0) return [];
    return getBlocksForDay(dayIndex).map((b) => ({
      start: b.startMinutes + b.durationMinutes,
      end: b.startMinutes + b.durationMinutes + bufferMinutes,
    }));
  }

  function adjustForBuffer(dayIndex: number, startMinutes: number, durationMinutes: number): number {
    if (bufferMinutes === 0) return startMinutes;
    const zones = getBufferZones(dayIndex);
    let adjusted = startMinutes;
    for (const zone of zones) {
      if (adjusted < zone.end && adjusted + durationMinutes > zone.start) {
        adjusted = zone.end;
      }
    }
    return clamp(adjusted, 0, 24 * 60 - durationMinutes);
  }

  function getExternalEventsForDay(dayIndex: number) {
    const dayDate = days[dayIndex];
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

  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT_PX;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day header row */}
      <div className="flex shrink-0 border-b border-ink/10">
        <div style={{ width: TIME_COLUMN_WIDTH }} className="shrink-0" />
        {dayLabels.map((label, i) => {
          const dayDate = days[i];
          const isToday = i === 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center pt-1.5 text-xs font-medium text-ink/60"
            >
              <div className="mb-1">
                <span className={isToday ? "font-semibold text-ink" : ""}>{label}</span>
                <span
                  className={`ml-1 ${isToday ? "bg-ink text-paper rounded-full px-1.5 py-0.5" : ""}`}
                >
                  {dayDate.getDate()}.
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
            className="shrink-0 relative border-r border-ink/10"
          >
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ top: h * HOUR_HEIGHT_PX }}
                className="absolute w-full text-right pr-2"
              >
                <span className="text-[10px] text-ink/30 leading-none -translate-y-1/2 inline-block">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((_, dayIndex) => {
            const blocks = getBlocksForDay(dayIndex);
            const extEvents = getExternalEventsForDay(dayIndex);
            const isGhostDay = ghost?.dayIndex === dayIndex;
            const isTodayCol = dayIndex === 0;

            const isNewBlockDay = newBlockGhost?.dayIndex === dayIndex;

            return (
              <div
                key={dayIndex}
                data-day={dayIndex}
                className={`flex-1 relative border-r border-ink/10 last:border-r-0 ${newBlockDrag ? "cursor-crosshair select-none" : ""}`}
                onDragOver={(e) => handleDragOver(e, dayIndex)}
                onDrop={(e) => handleDrop(e, dayIndex)}
                onMouseDown={(e) => handleColMouseDown(e, dayIndex)}
              >
                {/* Hour grid lines — strongest */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ top: h * HOUR_HEIGHT_PX, borderColor: gridHour }}
                    className="absolute inset-x-0 border-t"
                  />
                ))}
                {/* Sub-hour lines */}
                {HOURS.map((h) => (
                  <Fragment key={h}>
                    <div
                      style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.25, borderColor: gridQuarter, borderStyle: "dotted" }}
                      className="absolute inset-x-0 border-t"
                    />
                    <div
                      style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.5, borderColor: gridHalf, borderStyle: "dashed" }}
                      className="absolute inset-x-0 border-t"
                    />
                    <div
                      style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.75, borderColor: gridQuarter, borderStyle: "dotted" }}
                      className="absolute inset-x-0 border-t"
                    />
                  </Fragment>
                ))}

                {/* Current time indicator (today only) */}
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

                {/* Transition buffer zones */}
                {bufferMinutes > 0 && blocks.map((block) => {
                  const bufTop = (block.startMinutes + block.durationMinutes) / 60 * HOUR_HEIGHT_PX;
                  const bufHeight = bufferMinutes / 60 * HOUR_HEIGHT_PX;
                  return (
                    <div
                      key={`buf-${block.id}`}
                      style={{
                        position: "absolute",
                        top: bufTop,
                        left: 0,
                        right: 0,
                        height: bufHeight,
                        pointerEvents: "none",
                        zIndex: 6,
                        background: `repeating-linear-gradient(
                          -45deg,
                          rgba(${ink},0.06) 0px,
                          rgba(${ink},0.06) 3px,
                          transparent 3px,
                          transparent 8px
                        )`,
                      }}
                    />
                  );
                })}

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
                    autoOpen={pendingOpenId === String(block.id)}
                  />
                ))}

                {/* New block creation ghost */}
                {isNewBlockDay && newBlockGhost && (() => {
                  const endMin = newBlockGhost.startMinutes + newBlockGhost.durationMinutes;
                  const label = `${formatMinutes(newBlockGhost.startMinutes, timeFormat)}–${formatMinutes(endMin, timeFormat)}`;
                  return (
                    <div
                      style={{
                        position: "absolute",
                        top: (newBlockGhost.startMinutes / 60) * HOUR_HEIGHT_PX,
                        left: 2,
                        right: 2,
                        height: Math.max((newBlockGhost.durationMinutes / 60) * HOUR_HEIGHT_PX, 12),
                        pointerEvents: "none",
                        zIndex: 20,
                      }}
                      className="border-2 border-dashed border-ink/50 rounded-md bg-ink/10 flex items-start justify-end"
                    >
                      <span className="text-[10px] text-ink/60 bg-surface/80 rounded px-1 py-0.5 m-0.5 leading-none whitespace-nowrap">
                        {label}
                      </span>
                    </div>
                  );
                })()}

                {/* Drag ghost */}
                {isGhostDay &&
                  ghost &&
                  (() => {
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
                        className="border-2 border-dashed border-ink/40 rounded-md bg-ink/5 flex items-start justify-end"
                      >
                        <span className="text-[10px] text-ink/50 bg-surface/80 rounded px-1 py-0.5 m-0.5 leading-none whitespace-nowrap">
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
