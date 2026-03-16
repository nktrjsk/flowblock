import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { GripVertical } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { TimeBlockId, TaskId } from "../../db/schema";
import {
  Priority,
  DRAG_DATA_KEY,
  DragPayload,
  HOUR_HEIGHT_PX,
  SNAP_MINUTES,
} from "../../constants";
import * as Evolu from "@evolu/common";
import TimeBlockPopover from "./TimeBlockPopover";
import { useTimeFormat, formatMinutes } from "../../contexts/TimeFormatContext";
import { usePriorityColors } from "../../hooks/usePriorityColors";

interface TimeBlockProps {
  id: TimeBlockId;
  taskId: TaskId | null;
  title: string;
  priority: string | null;
  startMinutes: number;
  durationMinutes: number;
}


function minutesToIso(date: Date, minutes: number): string {
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toISOString();
}

type ResizeEdge = "top" | "bottom";

interface TimeBlockComponentProps extends TimeBlockProps {
  dayDate: Date;
  taskTitle?: string | null;
  onResizeChange?: (id: string, liveStart: number | null, liveEnd: number | null) => void;
}

export default function TimeBlock({
  id,
  taskId,
  title,
  priority,
  startMinutes,
  durationMinutes,
  dayDate,
  taskTitle,
  onResizeChange,
}: TimeBlockComponentProps) {
  const [liveResize, setLiveResize] = useState<{
    startMinutes: number;
    endMinutes: number;
  } | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number } | null>(null);
  const { update } = useEvolu();
  const { timeFormat } = useTimeFormat();
  const blockRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<{
    edge: ResizeEdge;
    startY: number;
    originalStart: number;
    originalEnd: number;
    currentStart: number;
    currentEnd: number;
  } | null>(null);
  const isDragging = useRef(false);
  const justDragged = useRef(false);
  const justResized = useRef(false);

  useEffect(() => {
    setLiveResize(null);
  }, [startMinutes, durationMinutes]);

  const priorityColors = usePriorityColors();
  const prio = (priority ?? "none") as Priority;
  const colors = priorityColors[prio] ?? priorityColors.none;

  const displayStart = liveResize?.startMinutes ?? startMinutes;
  const displayEnd = liveResize?.endMinutes ?? (startMinutes + durationMinutes);
  const displayDuration = displayEnd - displayStart;

  const top = (displayStart / 60) * HOUR_HEIGHT_PX;
  const height = Math.max((displayDuration / 60) * HOUR_HEIGHT_PX, 12);
  const endMinutes = displayEnd;

  function handleDragStart(e: React.DragEvent) {
    if (resizingRef.current) {
      e.preventDefault();
      return;
    }
    isDragging.current = true;
    const blockTopPx = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const cursorOffsetPx = e.clientY - blockTopPx;
    const offsetMinutes = Math.round((cursorOffsetPx / HOUR_HEIGHT_PX) * 60 / SNAP_MINUTES) * SNAP_MINUTES;

    const payload: DragPayload = {
      type: "timeblock",
      timeBlockId: id,
      offsetMinutes,
      taskId: taskId ?? undefined,
    };
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    isDragging.current = false;
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 200);
  }

  function handleClick(e: React.MouseEvent) {
    if (justDragged.current) return;
    if (justResized.current) return;
    if (resizingRef.current) return;
    e.stopPropagation();
    setAnchorPos({ x: e.clientX, y: e.clientY });
    setPopoverOpen(true);
  }

  function handleResizeMouseDown(e: React.MouseEvent, edge: ResizeEdge) {
    e.preventDefault();
    e.stopPropagation();
    const originalEnd = startMinutes + durationMinutes;
    resizingRef.current = {
      edge,
      startY: e.clientY,
      originalStart: startMinutes,
      originalEnd,
      currentStart: startMinutes,
      currentEnd: originalEnd,
    };

    function onMouseMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const { edge, startY, originalStart, originalEnd } = resizingRef.current;
      const deltaY = ev.clientY - startY;
      const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT_PX) * 60 / SNAP_MINUTES) * SNAP_MINUTES;

      if (edge === "bottom") {
        const newEnd = Math.min(Math.max(originalStart + SNAP_MINUTES, originalEnd + deltaMinutes), 24 * 60);
        resizingRef.current.currentEnd = newEnd;
        flushSync(() => setLiveResize({ startMinutes: originalStart, endMinutes: newEnd }));
        onResizeChange?.(id, originalStart, newEnd);
      } else {
        const newStart = Math.max(0, Math.min(originalEnd - SNAP_MINUTES, originalStart + deltaMinutes));
        resizingRef.current.currentStart = newStart;
        flushSync(() => setLiveResize({ startMinutes: newStart, endMinutes: originalEnd }));
        onResizeChange?.(id, newStart, originalEnd);
      }
    }

    function onMouseUp() {
      if (resizingRef.current) {
        const { edge, currentStart, currentEnd } = resizingRef.current;
        if (edge === "bottom") {
          update("timeBlock", {
            id,
            end: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, currentEnd)),
          });
        } else {
          update("timeBlock", {
            id,
            start: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, currentStart)),
          });
        }
      }
      resizingRef.current = null;
      onResizeChange?.(id, null, null);
      justResized.current = true;
      setTimeout(() => { justResized.current = false; }, 200);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <>
      <div
        ref={blockRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        style={{
          position: "absolute",
          top,
          left: 2,
          right: 2,
          height,
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.border}`,
          color: colors.text,
          zIndex: 10,
        }}
        className="rounded-sm cursor-pointer select-none group overflow-visible"
      >
        {/* Top resize handle */}
        <div
          onMouseDown={(e) => handleResizeMouseDown(e, "top")}
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface border border-ink/20 opacity-0 group-hover:opacity-100 cursor-n-resize z-20 flex items-center justify-center"
          style={{ pointerEvents: "auto" }}
        >
          <GripVertical size={12} className="text-ink/40" />
        </div>

        {/* Content */}
        <div className="h-full flex flex-col justify-start pt-0.5 px-1.5 overflow-hidden">
          <span className="text-[10px] opacity-60 leading-none">
            {formatMinutes(displayStart, timeFormat)}–{formatMinutes(endMinutes, timeFormat)}
          </span>
          <span className="text-xs font-medium leading-tight mt-0.5 truncate">
            {title}
          </span>
        </div>

        {/* Bottom resize handle */}
        <div
          onMouseDown={(e) => handleResizeMouseDown(e, "bottom")}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded-full bg-surface border border-ink/20 opacity-0 group-hover:opacity-100 cursor-s-resize z-20 flex items-center justify-center"
          style={{ pointerEvents: "auto" }}
        >
          <GripVertical size={12} className="text-ink/40" />
        </div>
      </div>

      {popoverOpen && anchorPos && (
        <TimeBlockPopover
          id={id}
          title={title}
          startMinutes={displayStart}
          endMinutes={endMinutes}
          priority={priority}
          taskId={taskId}
          taskTitle={taskTitle ?? null}
          dayDate={dayDate}
          anchorPos={anchorPos}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </>
  );
}
