import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { TimeBlockId, TaskId } from "../../db/schema";
import { PRIORITY_COLORS, Priority } from "../../constants";
import * as Evolu from "@evolu/common";
import { useTimeFormat, formatMinutes, type TimeFormat } from "../../contexts/TimeFormatContext";

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

function minutesToTimeStr(minutes: number, format: TimeFormat): string {
  return formatMinutes(minutes, format);
}

function timeStrToMinutes(str: string, format: TimeFormat): number | null {
  const s = str.trim();
  if (format === "12h") {
    const match = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === "AM" && h === 12) h = 0;
    if (period === "PM" && h !== 12) h += 12;
    return h * 60 + m;
  }
  const parts = s.split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function snapTo15(min: number): number {
  return Math.round(min / 15) * 15;
}

function minutesToIso(date: Date, minutes: number): string {
  const d = new Date(date);
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
  const [startValue, setStartValue] = useState(() => minutesToTimeStr(startMinutes, timeFormat));
  const [endValue, setEndValue] = useState(() => minutesToTimeStr(endMinutes, timeFormat));
  const [prioValue, setPrioValue] = useState<Priority>((priority ?? "none") as Priority);

  // Positioning: prefer left of block, fallback right
  const spaceLeft = anchorRect.left;
  const left =
    spaceLeft >= POPOVER_WIDTH + 8
      ? anchorRect.left - POPOVER_WIDTH - 8
      : anchorRect.right + 8;

  const estimatedHeight = 280;
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - estimatedHeight - 8));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    const trimmed = titleValue.trim();
    if (trimmed) {
      const r = Evolu.NonEmptyString1000.from(trimmed);
      if (r.ok) update("timeBlock", { id, title: r.value });
    }

    const startMin = timeStrToMinutes(startValue, timeFormat);
    if (startMin !== null) {
      const snapped = Math.max(0, Math.min(snapTo15(startMin), 23 * 60 + 45));
      update("timeBlock", {
        id,
        start: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, snapped)),
      });
    }

    const endMin = timeStrToMinutes(endValue, timeFormat);
    if (endMin !== null) {
      const snapped = Math.max(15, Math.min(snapTo15(endMin), 24 * 60));
      update("timeBlock", {
        id,
        end: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, snapped)),
      });
    }

    update("timeBlock", {
      id,
      priority: Evolu.NonEmptyString100.orThrow(prioValue),
    });

    onClose();
  }

  function handleDelete() {
    update("timeBlock", { id, isDeleted: 1 });
    if (taskId) {
      update("task", { id: taskId, status: Evolu.NonEmptyString100.orThrow("inbox") });
    }
    onClose();
  }

  function handleDisconnect() {
    update("timeBlock", { id, task_id: null });
    if (taskId) {
      update("task", { id: taskId, status: Evolu.NonEmptyString100.orThrow("inbox") });
    }
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
        <div className="flex items-center gap-2 text-xs text-[#1a1a2e]/60">
          <span className="shrink-0">Začátek</span>
          <input
            type="text"
            value={startValue}
            onChange={(e) => setStartValue(e.target.value)}
            placeholder={timeFormat === "12h" ? "8:00 AM" : "08:00"}
            className="border border-[#1a1a2e]/15 rounded px-2 py-1 text-xs bg-transparent outline-none focus:border-[#1a1a2e]/40 w-[90px]"
          />
          <span className="shrink-0">Konec</span>
          <input
            type="text"
            value={endValue}
            onChange={(e) => setEndValue(e.target.value)}
            placeholder={timeFormat === "12h" ? "9:00 AM" : "09:00"}
            className="border border-[#1a1a2e]/15 rounded px-2 py-1 text-xs bg-transparent outline-none focus:border-[#1a1a2e]/40 w-[90px]"
          />
        </div>

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
            className="text-xs px-3 py-1.5 bg-[#1a1a2e] text-[#f5f0e8] rounded-lg hover:bg-[#1a1a2e]/85 transition-colors"
          >
            Hotovo
          </button>
        </div>
      </div>
    </>
  );
}
