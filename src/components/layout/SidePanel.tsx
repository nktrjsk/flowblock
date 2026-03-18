import { useState } from "react";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { TaskId, TimeBlockId } from "../../db/schema";
import { DRAG_DATA_KEY, DragPayload } from "../../constants";
import TaskItem from "../inbox/TaskItem";
import NoteItem from "../inbox/NoteItem";
import AddTaskInput from "../inbox/AddTaskInput";
import NowBlock from "../dashboard/NowBlock";
import UpcomingList from "../dashboard/UpcomingList";
import * as Evolu from "@evolu/common";

const inboxTasksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("inbox"))
    .where("isDeleted", "is", null)
    .orderBy("createdAt", "asc"),
);

const doneTasksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("done"))
    .where("isDeleted", "is", null)
    .orderBy("updatedAt", "desc"),
);

const notesQuery = evolu.createQuery((db) =>
  db
    .selectFrom("note")
    .select(["id", "content", "status"])
    .where("isDeleted", "is", null)
    .orderBy("createdAt", "asc"),
);

export default function SidePanel() {
  const [doneOpen, setDoneOpen] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const { update } = useEvolu();

  const inboxRows = useQuery(inboxTasksQuery);
  const doneRows = useQuery(doneTasksQuery);
  const allNoteRows = useQuery(notesQuery);
  const noteRows = allNoteRows.filter((r) => r.status === "new");

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(DRAG_DATA_KEY)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropHover(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
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

    update("timeBlock", {
      id: payload.timeBlockId as unknown as TimeBlockId,
      isDeleted: 1,
    });

    if (payload.taskId) {
      update("task", {
        id: payload.taskId as unknown as TaskId,
        status: Evolu.NonEmptyString100.orThrow("inbox"),
      });
    }
  }

  return (
    <div
      className={`w-96 flex flex-col overflow-y-auto border-r border-ink/10 shrink-0 transition-colors ${dropHover ? "bg-ink/8 border-ink/30" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <NowBlock />

      <div className="mx-3 mb-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink/40 px-1 mb-1">
          Inbox
        </div>
        {noteRows.map((row) => (
          <NoteItem key={row.id} id={row.id} content={row.content ?? ""} />
        ))}
        {noteRows.length > 0 && inboxRows.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1 my-0.5">
            <div className="flex-1 border-t border-dashed border-ink/20" />
            <span className="text-[10px] text-ink/30 uppercase tracking-wider shrink-0">Úkoly</span>
            <div className="flex-1 border-t border-dashed border-ink/20" />
          </div>
        )}
        {inboxRows.length === 0 && noteRows.length === 0 && (
          <p className="text-xs text-ink/30 text-center py-4">Žádné úkoly</p>
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
        <div className="mt-1">
          <AddTaskInput />
        </div>
      </div>

      <UpcomingList />

      <div className="mx-3 mb-3 px-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-1">
          Projekty
        </div>
        <p className="text-xs text-ink/30">Projekty (brzy)</p>
      </div>

      {doneRows.length > 0 && (
        <div className="mx-3 mb-3">
          <button
            onClick={() => setDoneOpen((v) => !v)}
            className="w-full text-left px-1 py-1 text-xs font-semibold uppercase tracking-wider text-ink/40 hover:text-ink/60 flex items-center gap-1"
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
  );
}
