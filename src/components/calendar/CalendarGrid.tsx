import { useState, useRef, useEffect, Fragment } from "react";
import { useQuerySubscription } from "@evolu/react";
import { evolu } from "../../db/evolu";
import {
  HOUR_HEIGHT_PX,
  SNAP_MINUTES,
  GRID_HEIGHT_PX,
  activeDrag,
  Priority,
} from "../../constants";
import TimeBlockComponent from "./TimeBlock";
import ExternalEvent from "./ExternalEvent";
import DayCapacityBars from "./DayCapacityBars";
import { useTimeFormat, formatMinutes } from "../../contexts/TimeFormatContext";
import { useTheme } from "../../contexts/ThemeContext";
import { usePriorityColors } from "../../hooks/usePriorityColors";
import { isoToDayMinutes } from "../../lib/time";
import { computeCollisionLayout } from "../../lib/calendarLayout";
import { useCalendarDnd } from "../../hooks/useCalendarDnd";
import { useNewBlockDrag } from "../../hooks/useNewBlockDrag";

const TIME_COLUMN_WIDTH = 48; // px
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Queries defined outside component — singleton pattern, pre-loaded to avoid Suspense on navigation/mutations
const timeBlocksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("timeBlock")
    .select(["id", "task_id", "title", "start", "end", "priority", "recurring_template_id"])
    .where("isDeleted", "is", null)
    .orderBy("start", "asc"),
);
evolu.loadQuery(timeBlocksQuery);

const tasksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority"])
    .where("isDeleted", "is", null),
);
evolu.loadQuery(tasksQuery);

const externalEventsQuery = evolu.createQuery((db) =>
  db
    .selectFrom("externalEvent")
    .select(["id", "calendar_id", "title", "start", "end", "is_all_day"])
    .where("isDeleted", "is", null)
    .orderBy("start", "asc"),
);
evolu.loadQuery(externalEventsQuery);


function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export interface CalendarGridProps {
  days: Date[];
  dayLabels: string[];
  /** Index of today in the days array, or -1 if today is not shown */
  todayIndex: number;
  /** "week" = short label + date without dot; "dashboard" = full label + bold today + dot */
  headerStyle?: "week" | "dashboard";
}

export default function CalendarGrid({ days, dayLabels, todayIndex, headerStyle = "week" }: CalendarGridProps) {
  const { timeFormat } = useTimeFormat();
  const { effectiveTheme } = useTheme();
  const ink = effectiveTheme === "dark" ? "245,240,232" : "26,26,46";
  const gridHour    = `rgba(${ink},0.20)`;
  const gridHalf    = `rgba(${ink},0.12)`;
  const gridQuarter = `rgba(${ink},0.07)`;
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

  const timeBlockRows = useQuerySubscription(timeBlocksQuery);
  const taskRows = useQuerySubscription(tasksQuery);
  const externalEventRows = useQuerySubscription(externalEventsQuery);
  const taskMap = new Map(taskRows.map((t) => [t.id, t]));
  const priorityColors = usePriorityColors();

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

  function getDayColumnEl(dayIndex: number): HTMLElement | null {
    return gridRef.current?.querySelector(`[data-day="${dayIndex}"]`) ?? null;
  }

  const { ghost, pendingMoves, handleDragOver, handleDragLeave, handleDrop } = useCalendarDnd({
    days,
    timeBlockRows,
    taskRows,
    getDayColumnEl,
  });

  const { newBlockDrag, newBlockGhost, pendingOpenId, handleColMouseDown } = useNewBlockDrag({
    days,
    getDayColumnEl,
  });

  function getPlannedMinutesForDay(dayIndex: number): number {
    const dayDate = days[dayIndex];
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    let planned = timeBlockRows
      .filter((b) => {
        if (!b.start) return false;
        const pending = pendingMoves.get(String(b.id));
        if (pending) return pending.dayIndex === dayIndex;
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
      if (activeDrag.payload?.type === "timeblock") {
        const origBlock = timeBlockRows.find((b) => b.id === (activeDrag.payload as { type: "timeblock"; timeBlockId: string }).timeBlockId);
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

    const raw = timeBlockRows
      .filter((b) => {
        if (!b.start) return false;
        const pending = pendingMoves.get(String(b.id));
        if (pending) return pending.dayIndex === dayIndex;
        const s = new Date(b.start);
        return s >= dayStart && s <= dayEnd;
      })
      .map((b) => {
        const task = b.task_id ? taskMap.get(b.task_id) : null;
        const pending = pendingMoves.get(String(b.id));
        const startMins = pending ? pending.startMinutes : isoToDayMinutes(b.start ?? "", dayDate);
        const durMins = pending ? pending.durationMinutes : Math.max(SNAP_MINUTES, isoToDayMinutes(b.end ?? "", dayDate) - isoToDayMinutes(b.start ?? "", dayDate));
        return {
          ...b,
          priority: (task?.priority ?? b.priority) ?? null,
          taskTitle: task?.title ? String(task.title) : null,
          startMinutes: startMins,
          durationMinutes: Math.max(SNAP_MINUTES, durMins),
          dayDate,
        };
      });

    // During drag: compute two layouts —
    //   layoutFull: dragged block keeps its current narrow appearance
    //   layoutWithout: other blocks expand as if dragged block is gone
    const draggedId = ghost && activeDrag.payload?.type === "timeblock"
      ? String(activeDrag.payload.timeBlockId)
      : null;

    if (draggedId) {
      const layoutFull = computeCollisionLayout(raw);
      const layoutWithout = computeCollisionLayout(raw.filter((b) => String(b.id) !== draggedId));
      return raw.map((b) => ({
        ...b,
        ...(String(b.id) === draggedId
          ? (layoutFull.get(draggedId) ?? { col: 0, totalCols: 1 })
          : (layoutWithout.get(String(b.id)) ?? { col: 0, totalCols: 1 })),
      }));
    }

    const layout = computeCollisionLayout(raw);
    return raw.map((b) => ({ ...b, ...(layout.get(String(b.id)) ?? { col: 0, totalCols: 1 }) }));
  }

  function getGhostLayout(dayIndex: number, startMinutes: number, durationMinutes: number, excludeId?: string): { col: number; totalCols: number } {
    const existing = getBlocksForDay(dayIndex)
      .filter((b) => excludeId ? String(b.id) !== excludeId : true)
      .map((b) => ({ id: String(b.id), startMinutes: b.startMinutes, durationMinutes: b.durationMinutes }));
    const ghostEntry = { id: "__ghost__", startMinutes, durationMinutes };
    const layout = computeCollisionLayout([...existing, ghostEntry]);
    return layout.get("__ghost__") ?? { col: 0, totalCols: 1 };
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
        const startMins = isoToDayMinutes(ev.start ?? "", dayDate);
        const endMins = isoToDayMinutes(ev.end ?? "", dayDate);
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
          const isToday = i === todayIndex;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center pt-1.5 text-xs font-medium text-ink/60"
            >
              <div className="mb-1">
                <span className={headerStyle === "dashboard" && isToday ? "font-semibold text-ink" : ""}>{label}</span>
                <span className={`ml-1 ${isToday ? "bg-ink text-paper rounded-full px-1.5 py-0.5" : ""}`}>
                  {dayDate.getDate()}{headerStyle === "dashboard" ? "." : ""}
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
        >
          {/* Time labels column */}
          <div style={{ width: TIME_COLUMN_WIDTH }} className="shrink-0 relative border-r border-ink/10">
            {HOURS.map((h) => (
              <div key={h} style={{ top: h * HOUR_HEIGHT_PX }} className="absolute w-full text-right pr-2">
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
            const isTodayCol = dayIndex === todayIndex;
            const isNewBlockDay = newBlockGhost?.dayIndex === dayIndex;
            // Tooltip on left side when in the right half of visible columns
            const tooltipOnLeft = dayIndex >= Math.floor(days.length / 2);

            return (
              <div
                key={dayIndex}
                data-day={dayIndex}
                className={`flex-1 relative border-r border-ink/10 last:border-r-0 ${newBlockDrag ? "cursor-crosshair select-none" : ""}`}
                onDragOver={(e) => handleDragOver(e, dayIndex)}
                onDrop={(e) => handleDrop(e, dayIndex)}
                onMouseDown={(e) => handleColMouseDown(e, dayIndex)}
              >
                {/* Hour grid lines */}
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
                    <div style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.25, borderColor: gridQuarter, borderStyle: "dotted" }} className="absolute inset-x-0 border-t" />
                    <div style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.5,  borderColor: gridHalf,    borderStyle: "dashed" }} className="absolute inset-x-0 border-t" />
                    <div style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX * 0.75, borderColor: gridQuarter, borderStyle: "dotted" }} className="absolute inset-x-0 border-t" />
                  </Fragment>
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

                {/* External events */}
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
                    recurringTemplateId={block.recurring_template_id ?? null}
                    startMinutes={block.startMinutes}
                    durationMinutes={block.durationMinutes}
                    dayDate={block.dayDate}
                    col={block.col}
                    totalCols={block.totalCols}
                    onResizeChange={handleResizeChange}
                    autoOpen={pendingOpenId === String(block.id)}
                  />
                ))}

                {/* New block creation ghost */}
                {isNewBlockDay && newBlockGhost && (() => {
                  const endMin = newBlockGhost.startMinutes + newBlockGhost.durationMinutes;
                  const label = `${formatMinutes(newBlockGhost.startMinutes, timeFormat)}–${formatMinutes(endMin, timeFormat)}`;
                  const { col, totalCols } = getGhostLayout(dayIndex, newBlockGhost.startMinutes, newBlockGhost.durationMinutes);
                  return (
                    <div
                      style={{
                        position: "absolute",
                        top: (newBlockGhost.startMinutes / 60) * HOUR_HEIGHT_PX,
                        left: `calc(${(col / totalCols) * 100}% + 2px)`,
                        width: `calc(${(1 / totalCols) * 100}% - 4px)`,
                        height: Math.max((newBlockGhost.durationMinutes / 60) * HOUR_HEIGHT_PX, 12),
                        pointerEvents: "none",
                        zIndex: 20,
                      }}
                      className={`border-2 border-dashed border-ink/50 rounded-md bg-ink/10 flex items-start ${tooltipOnLeft ? "justify-start" : "justify-end"}`}
                    >
                      <span className="text-[10px] text-ink/60 bg-surface/80 rounded px-1 py-0.5 m-0.5 leading-none whitespace-nowrap">
                        {label}
                      </span>
                    </div>
                  );
                })()}

                {/* Drag ghost */}
                {isGhostDay && ghost && (() => {
                  const endMin = ghost.startMinutes + ghost.durationMinutes;
                  const label = `${formatMinutes(ghost.startMinutes, timeFormat)}–${formatMinutes(endMin, timeFormat)}`;
                  const excludeId = activeDrag.payload?.type === "timeblock" ? activeDrag.payload.timeBlockId : undefined;
                  const { col, totalCols } = getGhostLayout(dayIndex, ghost.startMinutes, ghost.durationMinutes, excludeId);

                  // Resolve title and priority from dragged payload
                  let ghostTitle: string | null = null;
                  let ghostPriority: string | null = null;
                  if (activeDrag.payload?.type === "timeblock") {
                    const tbId = activeDrag.payload.timeBlockId;
                    const block = timeBlockRows.find((b) => String(b.id) === String(tbId));
                    if (block) {
                      const linkedTask = block.task_id ? taskMap.get(block.task_id) : null;
                      ghostTitle = linkedTask?.title ?? block.title ?? null;
                      ghostPriority = block.priority ?? null;
                    }
                  } else if (activeDrag.payload?.type === "task") {
                    const task = taskMap.get(activeDrag.payload.taskId as never);
                    if (task) {
                      ghostTitle = task.title ?? null;
                      ghostPriority = task.priority ?? null;
                    }
                  }
                  const prio = (ghostPriority ?? "none") as Priority;
                  const colors = priorityColors[prio] ?? priorityColors.none;

                  return (
                    <div
                      style={{
                        position: "absolute",
                        top: (ghost.startMinutes / 60) * HOUR_HEIGHT_PX,
                        left: `calc(${(col / totalCols) * 100}% + 2px)`,
                        width: `calc(${(1 / totalCols) * 100}% - 4px)`,
                        height: Math.max((ghost.durationMinutes / 60) * HOUR_HEIGHT_PX, 12),
                        pointerEvents: "none",
                        zIndex: 20,
                        borderLeft: `3px solid ${colors.border}`,
                      }}
                      className="absolute rounded-sm border border-dashed border-ink/30 bg-ink/5 overflow-hidden"
                    >
                      <div className="h-full flex flex-col justify-start pt-0.5 px-1.5 overflow-hidden">
                        <span className="text-[10px] opacity-50 leading-none truncate">
                          {label}
                        </span>
                        {ghostTitle && (
                          <span className="text-xs leading-tight mt-0.5 truncate opacity-60">
                            {ghostTitle}
                          </span>
                        )}
                      </div>
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
