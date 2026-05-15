import { useState, useEffect, useRef, useReducer } from "react";
import { X, Trash2, Link2, Link2Off } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { useQuerySubscription } from "@evolu/react";
import { TimeBlockId, TaskId, RecurringTemplateId } from "../../db/schema";
import { Priority } from "../../constants";
import { usePreferences } from "../../hooks/usePreferences";
import * as Evolu from "@evolu/common";
import { useTimeFormat } from "../../contexts/TimeFormatContext";
import TimeSegmentInput from "./TimeSegmentInput";
import type { TimeSegmentInputHandle } from "./TimeSegmentInput";
import { usePriorityColors } from "../../hooks/usePriorityColors";
import { dayMinutesToIso } from "../../lib/time";
import { deleteTimeBlock } from "../../services/timeBlocks";
import { setTaskStatus } from "../../services/tasks";
import TimeBlockRepeatSection from "./TimeBlockRepeatSection";
import { allTasksQuery } from "../../db/queries";

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
  recurringTemplateId?: RecurringTemplateId | null;
}

type FormState = {
  title: string;
  startMin: number;
  endMin: number;
  endDayOffset: number;
  priority: Priority;
};

type FormAction =
  | { type: "setTitle"; value: string }
  | { type: "setStartMin"; value: number }
  | { type: "setEndMin"; value: number }
  | { type: "setEndDayOffset"; value: number }
  | { type: "setPriority"; value: Priority };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setTitle":
      return { ...state, title: action.value };
    case "setStartMin":
      return { ...state, startMin: action.value };
    case "setEndMin":
      return { ...state, endMin: action.value };
    case "setEndDayOffset":
      return { ...state, endDayOffset: action.value };
    case "setPriority":
      return { ...state, priority: action.value };
  }
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
  recurringTemplateId,
}: TimeBlockPopoverProps) {
  const { update } = useEvolu();
  const { timeFormat } = useTimeFormat();
  const priorityColors = usePriorityColors();
  const taskRows = useQuerySubscription(allTasksQuery);

  const [form, dispatch] = useReducer(formReducer, {
    title,
    startMin: startMinutes % (24 * 60),
    endMin: endMinutes % (24 * 60),
    endDayOffset: Math.floor(endMinutes / (24 * 60)),
    priority: (priority ?? "none") as Priority,
  });

  const [taskSearch, setTaskSearch] = useState("");
  const [showTaskSearch, setShowTaskSearch] = useState(false);
  const [taskSearchFocused, setTaskSearchFocused] = useState(false);
  const [taskDropdownIdx, setTaskDropdownIdx] = useState(0);

  const taskSearchRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<TimeSegmentInputHandle>(null);
  const endRef = useRef<TimeSegmentInputHandle>(null);
  const adjusterRef = useRef<HTMLSpanElement>(null);
  const prioGroupRef = useRef<HTMLDivElement>(null);
  const hotovoBtnRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteBtnRef = useRef<HTMLButtonElement>(null);

  const [prioFocused, setPrioFocused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { shortcutHints: showHints } = usePreferences();

  const endAbsolute = form.endDayOffset * 1440 + form.endMin;
  const isValid = endAbsolute > form.startMin;

  const estimatedHeight = 300;
  const left = Math.max(
    8,
    Math.min(
      Math.round(anchorPos.x - POPOVER_WIDTH / 2),
      window.innerWidth - POPOVER_WIDTH - 8,
    ),
  );
  const top = Math.max(
    8,
    Math.min(anchorPos.y - 16, window.innerHeight - estimatedHeight - 8),
  );

  const handleSaveRef = useRef<() => void>(() => {});

  function handleSave() {
    if (!isValid) return;
    const trimmed = form.title.trim();
    const titleResult = trimmed ? Evolu.NonEmptyString1000.from(trimmed) : null;
    update("timeBlock", {
      id,
      start: Evolu.NonEmptyString100.orThrow(
        dayMinutesToIso(dayDate, form.startMin, 0),
      ),
      end: Evolu.NonEmptyString100.orThrow(
        dayMinutesToIso(dayDate, form.endMin, form.endDayOffset),
      ),
      priority: Evolu.NonEmptyString100.orThrow(form.priority),
      ...(titleResult?.ok ? { title: titleResult.value } : {}),
    });
    onClose();
  }

  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (showDeleteConfirm) cancelDeleteRef.current?.focus();
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (showTaskSearch) taskSearchRef.current?.focus();
  }, [showTaskSearch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          return;
        }
        onClose();
      }
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        handleSaveRef.current();
      }
      if (
        e.key === "Delete" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setShowDeleteConfirm(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, showDeleteConfirm]);

  function handleDelete() {
    deleteTimeBlock(id, { resetTaskId: taskId });
    onClose();
  }

  function handleDisconnect() {
    update("timeBlock", { id, task_id: null });
    if (taskId) setTaskStatus(taskId, "inbox");
    onClose();
  }

  const filteredTasks = taskRows.filter((t) => {
    if (!t.title) return false;
    if (String(t.status) === "done") return false;
    return String(t.title).toLowerCase().includes(taskSearch.toLowerCase());
  });

  function handleTaskAssign(task: (typeof taskRows)[number]) {
    update("timeBlock", { id, task_id: task.id });
    if (taskId && taskId !== task.id) setTaskStatus(taskId, "inbox");
    setTaskStatus(task.id as TaskId, "planned");
    setShowTaskSearch(false);
    setTaskSearch("");
    onClose();
  }

  function focusAfterEnd() {
    prioGroupRef.current?.focus();
  }

  function handlePrioKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const idx = PRIORITIES.indexOf(form.priority);
      dispatch({
        type: "setPriority",
        value: PRIORITIES[Math.min(PRIORITIES.length - 1, idx + 1)],
      });
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const idx = PRIORITIES.indexOf(form.priority);
      dispatch({
        type: "setPriority",
        value: PRIORITIES[Math.max(0, idx - 1)],
      });
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (!taskId || showTaskSearch) {
        taskSearchRef.current?.focus();
      } else {
        hotovoBtnRef.current?.focus();
      }
    }
  }

  return (
    <>
      <div
        data-popover="true"
        className="fixed inset-0 z-[90]"
        onClick={onClose}
        onMouseDown={(e) => e.stopPropagation()}
      />

      <div
        data-popover="true"
        style={{ position: "fixed", left, top, width: POPOVER_WIDTH, zIndex: 100 }}
        className="bg-surface rounded-xl shadow-xl border border-ink/10 p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
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
          onFocus={(e) => e.target.select()}
          value={form.title}
          onChange={(e) =>
            dispatch({ type: "setTitle", value: e.target.value })
          }
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
              totalMinutes={form.startMin}
              format={timeFormat}
              onChange={(v) => dispatch({ type: "setStartMin", value: v })}
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
                  onClick={() =>
                    dispatch({
                      type: "setEndDayOffset",
                      value: Math.max(0, form.endDayOffset - 1),
                    })
                  }
                  disabled={form.endDayOffset === 0}
                  className="text-[10px] text-ink/35 hover:text-ink/70 disabled:opacity-20 transition-colors leading-none"
                  title="O den dříve"
                >
                  −1d
                </button>
                <button
                  tabIndex={-1}
                  onClick={() =>
                    dispatch({
                      type: "setEndDayOffset",
                      value: form.endDayOffset + 1,
                    })
                  }
                  className="text-[10px] text-ink/35 hover:text-ink/70 transition-colors leading-none"
                  title="O den később"
                >
                  +1d
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <TimeSegmentInput
                ref={endRef}
                totalMinutes={form.endMin}
                format={timeFormat}
                onChange={(v) => dispatch({ type: "setEndMin", value: v })}
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
                    dispatch({
                      type: "setEndDayOffset",
                      value: form.endDayOffset + 1,
                    });
                  }
                  if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const newVal = form.endDayOffset - 1;
                    if (newVal < 0) {
                      endRef.current?.focusLast();
                    } else {
                      dispatch({ type: "setEndDayOffset", value: newVal });
                    }
                  }
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    prioGroupRef.current?.focus();
                  }
                }}
                className={`text-[9px] rounded px-1 py-0.5 shrink-0 leading-none cursor-default outline-none focus:ring-1 focus:ring-ink/30 transition-colors ${
                  form.endDayOffset > 0
                    ? "text-ink/50 bg-ink/8"
                    : "text-ink/20 bg-transparent"
                }`}
              >
                {form.endDayOffset > 0 ? `+${form.endDayOffset}d` : "+0d"}
              </span>
            </div>
          </div>
        </div>

        {/* Validation error */}
        {!isValid && (
          <p className="text-[10px] text-red-500 -mt-1.5">
            Konec musí být po začátku
          </p>
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
              onClick={() => dispatch({ type: "setPriority", value: p })}
              title={
                p === "none"
                  ? "žádná"
                  : p === "low"
                    ? "nízká"
                    : p === "medium"
                      ? "střední"
                      : "vysoká"
              }
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all ${
                form.priority === p ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
              style={{
                backgroundColor: priorityColors[p].bg,
                color: priorityColors[p].text,
                outline:
                  prioFocused && form.priority === p
                    ? `2px solid ${priorityColors[p].border}`
                    : undefined,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: priorityColors[p].border }}
              />
              {p === "none"
                ? "—"
                : p === "low"
                  ? "nízká"
                  : p === "medium"
                    ? "střední"
                    : "vysoká"}
            </button>
          ))}
        </div>

        {/* Task linking */}
        <div className="relative">
          {taskId && !showTaskSearch ? (
            <div className="flex items-center gap-2 text-xs text-ink/60 bg-ink/5 rounded-lg px-3 py-2">
              <Link2 size={11} className="shrink-0 text-ink/40" />
              <span className="flex-1 truncate text-ink/80">
                {taskTitle ?? "—"}
              </span>
              <button
                tabIndex={-1}
                onClick={() => setShowTaskSearch(true)}
                className="shrink-0 hover:text-ink transition-colors"
                title="Změnit úkol"
              >
                <Link2 size={11} />
              </button>
              <button
                tabIndex={-1}
                onClick={handleDisconnect}
                className="shrink-0 hover:text-red-500 transition-colors"
                title="Odpojit úkol"
              >
                <Link2Off size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-ink/5 rounded-lg px-3 py-2">
              <Link2 size={11} className="shrink-0 text-ink/40" />
              <input
                ref={taskSearchRef}
                value={taskSearch}
                onChange={(e) => {
                  setTaskSearch(e.target.value);
                  setTaskDropdownIdx(0);
                }}
                onFocus={() => setTaskSearchFocused(true)}
                onBlur={() => setTaskSearchFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (taskId) {
                      setShowTaskSearch(false);
                      setTaskSearch("");
                    } else taskSearchRef.current?.blur();
                  }
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    hotovoBtnRef.current?.focus();
                  }
                  if (e.key === "Tab" && e.shiftKey) {
                    e.preventDefault();
                    prioGroupRef.current?.focus();
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setTaskDropdownIdx((i) =>
                      Math.min(i + 1, filteredTasks.length - 1),
                    );
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setTaskDropdownIdx((i) => Math.max(i - 1, 0));
                  }
                  if (e.key === "Enter" && filteredTasks[taskDropdownIdx]) {
                    handleTaskAssign(filteredTasks[taskDropdownIdx]);
                  }
                }}
                placeholder="Přiřadit úkol…"
                className="flex-1 text-xs bg-transparent outline-none placeholder:text-ink/40"
              />
            </div>
          )}

          {taskSearchFocused && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-ink/15 rounded-lg shadow-lg z-[110] overflow-hidden">
              <div className="max-h-40 overflow-y-auto">
                {filteredTasks.length === 0 ? (
                  <p className="text-xs text-ink/40 px-3 py-2">Žádné úkoly</p>
                ) : (
                  filteredTasks.map((t, i) => (
                    <button
                      key={String(t.id)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleTaskAssign(t);
                      }}
                      className={`w-full text-left text-xs px-3 py-2 truncate transition-colors ${
                        i === taskDropdownIdx
                          ? "bg-ink/8 text-ink"
                          : "text-ink/70 hover:bg-ink/5"
                      }`}
                    >
                      {String(t.title)}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Repeat section */}
        <TimeBlockRepeatSection
          blockId={id}
          recurringTemplateId={recurringTemplateId}
          startMinutes={startMinutes}
          endMinutes={endMinutes}
          blockTitle={form.title}
          onClose={onClose}
        />

        {/* Actions */}
        {showDeleteConfirm ? (
          <div className="flex items-center justify-between pt-1 border-t border-ink/8">
            <span className="text-xs text-ink/60">Smazat blok?</span>
            <div className="flex gap-2">
              <button
                ref={cancelDeleteRef}
                onClick={() => setShowDeleteConfirm(false)}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    confirmDeleteBtnRef.current?.focus();
                  }
                }}
                className="text-xs px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors"
              >
                Zrušit
              </button>
              <button
                ref={confirmDeleteBtnRef}
                onClick={handleDelete}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    cancelDeleteRef.current?.focus();
                  }
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
              {showHints && (
                <span className="text-[9px] opacity-50 ml-0.5">Del</span>
              )}
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
              {showHints && (
                <span className="text-[9px] opacity-50">Ctrl+↵</span>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
