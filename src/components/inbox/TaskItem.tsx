import { useState, useRef } from "react";
import confetti from "canvas-confetti";
import { Flag } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { TaskId } from "../../db/schema";
import { Priority, DRAG_DATA_KEY, DragPayload, activeDrag } from "../../constants";
import { usePriorityColors } from "../../hooks/usePriorityColors";
import { useToast } from "../ui/Toast";
import * as Evolu from "@evolu/common";

interface TaskItemProps {
  id: TaskId;
  title: string;
  priority: string | null;
  status: string;
  energy?: string | null;
  waitingFor?: string | null;
}

export default function TaskItem({ id, title, priority, status, energy, waitingFor }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [checkAnim, setCheckAnim] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const { update } = useEvolu();
  const toast = useToast();

  const priorityColors = usePriorityColors();
  const prio = (priority ?? "none") as Priority;
  const colors = priorityColors[prio] ?? priorityColors.none;

  function fireConfetti() {
    const btn = checkboxRef.current;
    if (!btn) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // CSS-only fallback: brief scale pulse via state
      setCheckAnim(true);
      setTimeout(() => setCheckAnim(false), 400);
      return;
    }

    const rect = btn.getBoundingClientRect();
    confetti({
      particleCount: 55,
      spread: 65,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ["#4f8ef7", "#4caf7a", "#e09b2f", "#e85d5d", "#9b59b6"],
      scalar: 0.75,
      ticks: 90,
    });
  }

  function handleCheck() {
    const newStatus = status === "done" ? "inbox" : "done";
    update("task", { id, status: Evolu.NonEmptyString100.orThrow(newStatus) });
    if (newStatus === "done") {
      toast.show("Hotovo!");
      fireConfetti();
    }
  }

  function handleDragStart(e: React.DragEvent) {
    const payload: DragPayload = { type: "task", taskId: id };
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    activeDrag.payload = payload;
  }

  function handleDragEnd() {
    activeDrag.payload = null;
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = editValue.trim();
      if (trimmed) {
        const result = Evolu.NonEmptyString1000.from(trimmed);
        if (result.ok) update("task", { id, title: result.value });
      }
      setEditing(false);
    } else if (e.key === "Escape") {
      setEditValue(title);
      setEditing(false);
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`relative flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-lg hover:bg-ink/5 group cursor-grab active:cursor-grabbing ${waitingFor != null ? "opacity-60" : ""}`}
    >
      {/* Priority bar — vertical strip on left edge */}
      <div
        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
        style={{ backgroundColor: colors.border }}
      />
      {/* Checkbox */}
      <button
        ref={checkboxRef}
        onClick={handleCheck}
        style={{
          transform: checkAnim ? "scale(1.35)" : "scale(1)",
          transition: "transform 0.2s ease",
        }}
        className="w-5 h-5 shrink-0 rounded border border-ink/30 flex items-center justify-center hover:border-ink/60 transition-colors"
      >
        {status === "done" && (
          <svg viewBox="0 0 10 10" className="w-3 h-3" fill="none">
            <path
              d="M2 5l2.5 2.5L8 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      {/* Title */}
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={() => {
            setEditValue(title);
            setEditing(false);
          }}
          className="flex-1 text-sm bg-transparent outline-none border-b border-ink/30"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-text ${status === "done" ? "line-through text-ink/40" : ""}`}
        >
          {title}
        </span>
      )}
      {energy === "draining" && (
        <span className="text-xs shrink-0 opacity-60" title="Vyčerpávající">⚡</span>
      )}
      {energy === "lite" && (
        <span className="text-xs shrink-0 opacity-60" title="Lehký">☁</span>
      )}
      {/* Priority picker */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setShowPriorityPicker((v) => !v); }}
          className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity p-0.5 rounded hover:bg-ink/10"
          title="Priorita"
        >
          <Flag size={12} style={{ color: colors.border }} />
        </button>
        {showPriorityPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPriorityPicker(false)}
            />
            <div className="absolute right-0 bottom-full mb-1 z-50 bg-surface rounded-lg shadow-lg border border-ink/10 py-1 min-w-[130px]">
              {(["none", "low", "medium", "high"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    update("task", { id, priority: Evolu.NonEmptyString100.orThrow(p) });
                    setShowPriorityPicker(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-ink/5 text-left"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: priorityColors[p].border }}
                  />
                  <span>
                    {p === "none" ? "žádná" : p === "low" ? "nízká" : p === "medium" ? "střední" : "vysoká"}
                  </span>
                  {prio === p && <span className="ml-auto text-ink/30">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
