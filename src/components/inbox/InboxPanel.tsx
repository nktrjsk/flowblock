import { useState } from "react";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { TaskId, TimeBlockId } from "../../db/schema";
import { DRAG_DATA_KEY, DragPayload } from "../../constants";
import TaskItem from "./TaskItem";
import AddTaskInput from "./AddTaskInput";
import * as Evolu from "@evolu/common";

const inboxTasksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("inbox"))
    .where("isDeleted", "is", null)
    .orderBy("createdAt", "asc"),
);

const plannedTasksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("planned"))
    .where("isDeleted", "is", null)
    .orderBy("updatedAt", "desc"),
);

const doneTasksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("done"))
    .where("isDeleted", "is", null)
    .orderBy("updatedAt", "desc"),
);

export default function InboxPanel() {
  const [doneOpen, setDoneOpen] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const { update } = useEvolu();

  const inboxRows = useQuery(inboxTasksQuery);
  const plannedRows = useQuery(plannedTasksQuery);
  const doneRows = useQuery(doneTasksQuery);

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(DRAG_DATA_KEY)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropHover(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear hover if leaving the panel entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropHover(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropHover(false);
    const raw = e.dataTransfer.getData(DRAG_DATA_KEY);
    if (!raw) return;
    const payload: DragPayload = JSON.parse(raw);
    if (payload.type !== "timeblock") return;

    // Soft-delete the time block
    update("timeBlock", {
      id: payload.timeBlockId as unknown as TimeBlockId,
      isDeleted: 1,
    });

    // Return linked task to inbox
    if (payload.taskId) {
      update("task", {
        id: payload.taskId as unknown as TaskId,
        status: Evolu.NonEmptyString100.orThrow("inbox"),
      });
    }
  }

  return (
    <aside
      className={`w-72 flex flex-col border-r border-[#1a1a2e]/10 transition-colors ${dropHover ? "bg-green-50 border-green-300" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3 border-b border-[#1a1a2e]/10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1a1a2e]/50">
          Inbox
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {inboxRows.length === 0 && (
          <p className="text-xs text-[#1a1a2e]/30 text-center py-6">
            Žádné úkoly
          </p>
        )}
        {inboxRows.map((row) => (
          <TaskItem
            key={row.id}
            id={row.id}
            title={row.title ?? ""}
            priority={row.priority}
            status={row.status ?? "inbox"}
            energy={row.energy}
            waitingFor={row.waiting_for}
          />
        ))}

        {/* Planned section */}
        {plannedRows.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="flex-1 border-t border-dashed border-[#1a1a2e]/20" />
              <span className="text-[10px] text-[#1a1a2e]/30 uppercase tracking-wider shrink-0">
                Plánováno
              </span>
              <div className="flex-1 border-t border-dashed border-[#1a1a2e]/20" />
            </div>
            <div className="opacity-50 pointer-events-none">
              {plannedRows.map((row) => (
                <TaskItem
                  key={row.id}
                  id={row.id}
                  title={row.title ?? ""}
                  priority={row.priority}
                  status={row.status ?? "planned"}
                  energy={row.energy}
                  waitingFor={row.waiting_for}
                />
              ))}
            </div>
          </div>
        )}

        {/* Done section */}
        {doneRows.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setDoneOpen((v) => !v)}
              className="w-full text-left px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#1a1a2e]/40 hover:text-[#1a1a2e]/60 flex items-center gap-1"
            >
              <span>{doneOpen ? "▼" : "►"}</span>
              <span>Hotovo ({doneRows.length})</span>
            </button>
            {doneOpen &&
              doneRows.map((row) => (
                <TaskItem
                  key={row.id}
                  id={row.id}
                  title={row.title ?? ""}
                  priority={row.priority}
                  status={row.status ?? "done"}
                  energy={row.energy}
                  waitingFor={row.waiting_for}
                />
              ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#1a1a2e]/10">
        <AddTaskInput />
      </div>
    </aside>
  );
}
