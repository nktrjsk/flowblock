import { useState, useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { TimeBlockId, TaskId } from "../../db/schema";
import { Priority, SHORTCUT_HINTS_KEY } from "../../constants";
import * as Evolu from "@evolu/common";
import { useTimeFormat } from "../../contexts/TimeFormatContext";
import TimeSegmentInput from "./TimeSegmentInput";
import type { TimeSegmentInputHandle } from "./TimeSegmentInput";
import { usePriorityColors } from "../../hooks/usePriorityColors";

const POPOVER_WIDTH = 272;
const PRIORITIES: Priority[] = ["none", "low", "medium", "high"];

interface TimeBlockPopoverProps {
  id: TimeBlockId;
  title: string;
  startMinutes: number;
  endMinutes: number;
  priority: string | null;
  taskId: TaskId | null;
  taskTitle: string | null;
  dayDate: Date;
  anchorPos: { x: number; y: number };
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
  anchorPos,
  onClose,
}: TimeBlockPopoverProps) {
  const { update } = useEvolu();
  const { timeFormat } = useTimeFormat();
  const priorityColors = usePriorityColors();
  const [titleValue, setTitleValue] = useState(title);

  const [startMin, setStartMin] = useState(startMinutes % (24 * 60));
  const [endMin, setEndMin] = useState(endMinutes % (24 * 60));
  const [endDayOffset, setEndDayOffset] = useState(Math.floor(endMinutes / (24 * 60)));
  const [prioValue, setPrioValue] = useState<Priority>((priority ?? "none") as Priority);

  const endAbsolute = endDayOffset * 1440 + endMin;
  const isValid = endAbsolute > startMin;

  const startRef = useRef<TimeSegmentInputHandle>(null);
  const endRef = useRef<TimeSegmentInputHandle>(null);
  const adjusterRef = useRef<HTMLSpanElement>(null);
  const prioGroupRef = useRef<HTMLDivElement>(null);
  const [prioFocused, setPrioFocused] = useState(false);
  const hotovoBtnRef = useRef<HTMLButtonElement>(null);
  const showHints = localStorage.getItem(SHORTCUT_HINTS_KEY) !== "false";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteBtnRef = useRef<HTMLButtonElement>(null);

  const handleSaveRef = useRef<() => void>(() => {});

  const estimatedHeight = 300;
  const left = Math.max(8, Math.min(
    Math.round(anchorPos.x - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - 8
  ));
  const top = Math.max(8, Math.min(anchorPos.y - 16, window.innerHeight - estimatedHeight - 8));

  function handleSave() {
    if (!isValid) return;
    const trimmed = titleValue.trim();
    if (trimmed) {
      const r = Evolu.NonEmptyString1000.from(trimmed);
      if (r.ok) update("timeBlock", { id, title: r.value });
    }
    update("timeBlock", { id, start: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, startMin, 0)) });
    update("timeBlock", { id, end: Evolu.NonEmptyString100.orThrow(minutesToIso(dayDate, endMin, endDayOffset)) });
    update("timeBlock", { id, priority: Evolu.NonEmptyString100.orThrow(prioValue) });
    onClose();
  }

  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (showDeleteConfirm) cancelDeleteRef.current?.focus();
  }, [showDeleteConfirm]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showDeleteConfirm) { setShowDeleteConfirm(false); return; }
        onClose();
      }
      if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSaveRef.current(); }
      if (e.key === "Delete" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowDeleteConfirm(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, showDeleteConfirm]);

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

  function focusAfterEnd() {
    prioGroupRef.current?.focus();
  }

  function handlePrioKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const idx = PRIORITIES.indexOf(prioValue);
      setPrioValue(PRIORITIES[Math.min(PRIORITIES.length - 1, idx + 1)]);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const idx = PRIORITIES.indexOf(prioValue);
      setPrioValue(PRIORITIES[Math.max(0, idx - 1)]);
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      hotovoBtnRef.current?.focus();
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />

      <div
        style={{ position: "fixed", left, top, width: POPOVER_WIDTH, zIndex: 100 }}
        className="bg-surface rounded-xl shadow-xl border border-ink/10 p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close — outside tab order, use Escape */}
        <button
          tabIndex={-1}
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-ink/5 text-ink/40 hover:text-ink/70 transition-colors"
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
          className="text-sm font-medium bg-transparent outline-none border-b border-ink/20 pb-1 pr-6 focus:border-ink/50"
          placeholder="Název bloku"
        />

        {/* Time row */}
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[10px] text-ink/40">Začátek</span>
            <TimeSegmentInput
              ref={startRef}
              totalMinutes={startMin}
              format={timeFormat}
              onChange={setStartMin}
              onTabOut={() => endRef.current?.focusFirst()}
              onArrowRight={() => endRef.current?.focusFirst()}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-ink/40">Konec</span>
              <div className="flex items-center gap-1">
                <button
                  tabIndex={-1}
                  onClick={() => setEndDayOffset(Math.max(0, endDayOffset - 1))}
                  disabled={endDayOffset === 0}
                  className="text-[10px] text-ink/35 hover:text-ink/70 disabled:opacity-20 transition-colors leading-none"
                  title="O den dříve"
                >
                  −1d
                </button>
                <button
                  tabIndex={-1}
                  onClick={() => setEndDayOffset(endDayOffset + 1)}
                  className="text-[10px] text-ink/35 hover:text-ink/70 transition-colors leading-none"
                  title="O den później"
                >
                  +1d
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <TimeSegmentInput
                ref={endRef}
                totalMinutes={endMin}
                format={timeFormat}
                onChange={setEndMin}
                hasError={!isValid}
                onTabOut={focusAfterEnd}
                onArrowRight={() => adjusterRef.current?.focus()}
                onArrowLeft={() => startRef.current?.focusLast()}
              />
              <span
                ref={adjusterRef}
                tabIndex={-1}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowRight") {
                    e.preventDefault();
                    setEndDayOffset((d) => d + 1);
                  }
                  if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const newVal = endDayOffset - 1;
                    if (newVal < 0) {
                      endRef.current?.focusLast();
                    } else {
                      setEndDayOffset(newVal);
                    }
                  }
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    prioGroupRef.current?.focus();
                  }
                }}
                className={`text-[9px] rounded px-1 py-0.5 shrink-0 leading-none cursor-default outline-none focus:ring-1 focus:ring-ink/30 transition-colors ${
                  endDayOffset > 0
                    ? "text-ink/50 bg-ink/8"
                    : "text-ink/20 bg-transparent"
                }`}
              >
                {endDayOffset > 0 ? `+${endDayOffset}d` : "+0d"}
              </span>
            </div>
          </div>
        </div>

        {/* Validation error */}
        {!isValid && (
          <p className="text-[10px] text-red-500 -mt-1.5">Konec musí být po začátku</p>
        )}

        {/* Priority — single focusable block, arrows change value */}
        <div
          ref={prioGroupRef}
          tabIndex={0}
          onKeyDown={handlePrioKeyDown}
          onFocus={() => setPrioFocused(true)}
          onBlur={() => setPrioFocused(false)}
          className="flex items-center gap-1 outline-none"
        >
          {PRIORITIES.map((p) => (
            <button
              key={p}
              tabIndex={-1}
              onClick={() => setPrioValue(p)}
              title={p === "none" ? "žádná" : p === "low" ? "nízká" : p === "medium" ? "střední" : "vysoká"}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all ${
                prioValue === p ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
              style={{
                backgroundColor: priorityColors[p].bg,
                color: priorityColors[p].text,
                outline: prioFocused && prioValue === p ? `2px solid ${priorityColors[p].border}` : undefined,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: priorityColors[p].border }}
              />
              {p === "none" ? "—" : p === "low" ? "nízká" : p === "medium" ? "střední" : "vysoká"}
            </button>
          ))}
        </div>

        {/* Connected task — outside tab order for now */}
        {taskId && (
          <div className="flex items-center gap-2 text-xs text-ink/60 bg-ink/5 rounded-lg px-3 py-2">
            <span className="flex-1 truncate">
              <span className="text-ink/40">Úkol: </span>
              <span className="text-ink/80">{taskTitle ?? "—"}</span>
            </span>
            <button
              tabIndex={-1}
              onClick={handleDisconnect}
              className="shrink-0 hover:text-red-500 transition-colors"
              title="Odpojit úkol"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Actions */}
        {showDeleteConfirm ? (
          <div className="flex items-center justify-between pt-1 border-t border-ink/8">
            <span className="text-xs text-ink/60">Smazat blok?</span>
            <div className="flex gap-2">
              <button
                ref={cancelDeleteRef}
                onClick={() => setShowDeleteConfirm(false)}
                onKeyDown={(e) => {
                  if (e.key === "Tab") { e.preventDefault(); confirmDeleteBtnRef.current?.focus(); }
                }}
                className="text-xs px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors"
              >
                Zrušit
              </button>
              <button
                ref={confirmDeleteBtnRef}
                onClick={handleDelete}
                onKeyDown={(e) => {
                  if (e.key === "Tab") { e.preventDefault(); cancelDeleteRef.current?.focus(); }
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Ano, smazat
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1 border-t border-ink/8">
            <button
              tabIndex={-1}
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={13} />
              Smazat
              {showHints && <span className="text-[9px] opacity-50 ml-0.5">Del</span>}
            </button>
            <button
              ref={hotovoBtnRef}
              onClick={handleSave}
              disabled={!isValid}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                isValid
                  ? "bg-ink text-paper hover:bg-ink/85"
                  : "bg-ink/15 text-ink/30 cursor-not-allowed"
              }`}
            >
              Hotovo
              {showHints && <span className="text-[9px] opacity-50">Ctrl+↵</span>}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
