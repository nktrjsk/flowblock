import { useState } from "react";
import { useEvolu } from "../../db/evolu";
import { TaskId } from "../../db/schema";
import { PRIORITY_COLORS, Priority, DRAG_DATA_KEY, DragPayload } from "../../constants";
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
  const { update } = useEvolu();
  const toast = useToast();

  const prio = (priority ?? "none") as Priority;
  const colors = PRIORITY_COLORS[prio] ?? PRIORITY_COLORS.none;

  function handleCheck() {
    const newStatus = status === "done" ? "inbox" : "done";
    update("task", { id, status: Evolu.NonEmptyString100.orThrow(newStatus) });
    if (newStatus === "done") toast.show("Hotovo! 🎉");
  }

  function handleDragStart(e: React.DragEvent) {
    const payload: DragPayload = { type: "task", taskId: id };
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
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
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[#1a1a2e]/5 group cursor-grab active:cursor-grabbing ${waitingFor != null ? "opacity-60" : ""}`}
    >
      {/* Priority dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: colors.border }}
      />
      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className="w-5 h-5 shrink-0 rounded border border-[#1a1a2e]/30 flex items-center justify-center hover:border-[#1a1a2e]/60 transition-colors"
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
          className="flex-1 text-sm bg-transparent outline-none border-b border-[#1a1a2e]/30"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-text ${status === "done" ? "line-through text-[#1a1a2e]/40" : ""}`}
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
    </div>
  );
}
