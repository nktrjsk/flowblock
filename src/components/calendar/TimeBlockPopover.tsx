import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { TimeBlockId, TaskId } from "../../db/schema";
import { PRIORITY_COLORS, Priority } from "../../constants";
import * as Evolu from "@evolu/common";
import { useTimeFormat } from "../../contexts/TimeFormatContext";
import TimeSegmentInput from "./TimeSegmentInput";

const POPOVER_WIDTH = 272;

interface TimeBlockPopoverProps {
  id: TimeBlockId;
  title: string;
  startMinutes: number;
  endMinutes: number;
  priority: string | null;
  taskId: TaskId | null;
  taskTitle: string | null;
  dayDate: Date;
  anchorRect: DOMRect;
  onClose: () => void;
}

function minutesToIso(date: Date, minutes: number, dayOffset = 0): string {
  const d = new Date(date);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toISOString();
}

export default function TimeBlockPopover({
  id,
  title,
  startMinutes,
  endMinutes,
  priority,
  taskId,
  taskTitle,
  dayDate,
  anchorRect,
  onClose,
}: TimeBlockPopoverProps) {
  const { update } = useEvolu();
  const { timeFormat } = useTimeFormat();
  const [titleValue, setTitleValue] = useState(title);

  // Normalize end to day offset + minutes-within-day
  const [startMin, setStartMin] = useState(startMinutes % (24 * 60));
  const [endMin, setEndMin] = useState(endMinutes % (24 * 60));
  const [endDayOffset, setEndDayOffset] = useState(Math.floor(endMinutes / (24 * 60)));
  const [prioValue, setPrioValue] = useState<Priority>((priority ?? "none") as Priority);

  const endAbsolute = endDayOffset * 1440 + endMin;
  const isValid = endAbsolute > startMin;

  // Positioning: prefer left of block, fallback right
  const spaceLeft = anchorRect.left;
  const left =
    spaceLeft >= POPOVER_WIDTH + 8
      ? anchorRect.left - POPOVER_WIDTH - 8
      : anchorRect.right + 8;

  const estimatedHeight = 300;
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - estimatedHeight - 8));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    if (!isValid) return;

    const trimmed = titleValue.trim();
    if (trimmed) {
      const r = Evolu.NonEmptyString1000.from(trimmed);
      if (r.ok) update("timeBlock", { id, title: r.value });
    }

    update("timeBlock", {
      id,
      start: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, startMin, 0)),
    });
    update("timeBlock", {
      id,
      end: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, endMin, endDayOffset)),
    });
    update("timeBlock", {
      id,
      priority: Evolu.NonEmptyString100.orThrow(prioValue),
    });

    onClose();
  }

  function handleDelete() {
    update("timeBlock", { id, isDeleted: 1 });
    if (taskId) update("task", { id: taskId, status: Evolu.NonEmptyString100.orThrow("inbox") });
    onClose();
  }

  function handleDisconnect() {
    update("timeBlock", { id, task_id: null });
    if (taskId) update("task", { id: taskId, status: Evolu.NonEmptyString100.orThrow("inbox") });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[90]" onClick={onClose} />

      {/* Popover */}
      <div
        style={{ position: "fixed", left, top, width: POPOVER_WIDTH, zIndex: 100 }}
        className="bg-white rounded-xl shadow-xl border border-[#1a1a2e]/10 p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-[#1a1a2e]/5 text-[#1a1a2e]/40 hover:text-[#1a1a2e]/70 transition-colors"
        >
          <X size={14} />
        </button>

        {/* Title */}
        <input
          autoFocus
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onClose();
          }}
          className="text-sm font-medium bg-transparent outline-none border-b border-[#1a1a2e]/20 pb-1 pr-6 focus:border-[#1a1a2e]/50"
          placeholder="Název bloku"
        />

        {/* Time row */}
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[10px] text-[#1a1a2e]/40">Začátek</span>
            <TimeSegmentInput
              totalMinutes={startMin}
              format={timeFormat}
              onChange={setStartMin}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#1a1a2e]/40">Konec</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEndDayOffset(Math.max(0, endDayOffset - 1))}
                  disabled={endDayOffset === 0}
                  className="text-[10px] text-[#1a1a2e]/35 hover:text-[#1a1a2e]/70 disabled:opacity-20 transition-colors leading-none"
                  title="O den dříve"
                >
                  −1d
                </button>
                <button
                  onClick={() => setEndDayOffset(endDayOffset + 1)}
                  className="text-[10px] text-[#1a1a2e]/35 hover:text-[#1a1a2e]/70 transition-colors leading-none"
                  title="O den později"
                >
                  +1d
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <TimeSegmentInput
                totalMinutes={endMin}
                format={timeFormat}
                onChange={setEndMin}
                hasError={!isValid}
              />
              {endDayOffset > 0 && (
                <span className="text-[9px] text-[#1a1a2e]/50 bg-[#1a1a2e]/8 rounded px-1 py-0.5 shrink-0 leading-none">
                  +{endDayOffset}d
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Validation error */}
        {!isValid && (
          <p className="text-[10px] text-red-500 -mt-1.5">Konec musí být po začátku</p>
        )}

        {/* Priority */}
        <div className="flex items-center gap-1">
          {(["none", "low", "medium", "high"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPrioValue(p)}
              title={p === "none" ? "žádná" : p === "low" ? "nízká" : p === "medium" ? "střední" : "vysoká"}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all ${
                prioValue === p ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
              style={{
                backgroundColor: PRIORITY_COLORS[p].bg,
                color: PRIORITY_COLORS[p].text,
                outline: prioValue === p ? `2px solid ${PRIORITY_COLORS[p].border}` : undefined,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: PRIORITY_COLORS[p].border }}
              />
              {p === "none" ? "—" : p === "low" ? "nízká" : p === "medium" ? "střední" : "vysoká"}
            </button>
          ))}
        </div>

        {/* Connected task */}
        {taskId && (
          <div className="flex items-center gap-2 text-xs text-[#1a1a2e]/60 bg-[#1a1a2e]/5 rounded-lg px-3 py-2">
            <span className="flex-1 truncate">
              <span className="text-[#1a1a2e]/40">Úkol: </span>
              <span className="text-[#1a1a2e]/80">{taskTitle ?? "—"}</span>
            </span>
            <button
              onClick={handleDisconnect}
              className="shrink-0 hover:text-red-500 transition-colors"
              title="Odpojit úkol"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1a1a2e]/8">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={13} />
            Smazat
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              isValid
                ? "bg-[#1a1a2e] text-[#f5f0e8] hover:bg-[#1a1a2e]/85"
                : "bg-[#1a1a2e]/15 text-[#1a1a2e]/30 cursor-not-allowed"
            }`}
          >
            Hotovo
          </button>
        </div>
      </div>
    </>
  );
}
