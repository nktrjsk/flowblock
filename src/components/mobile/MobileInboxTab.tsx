import { useState } from "react";
import { useQuerySubscription } from "@evolu/react";
import { evolu } from "../../db/evolu";
import * as Evolu from "@evolu/common";
import TaskItem from "../inbox/TaskItem";
import NoteItem from "../inbox/NoteItem";

const inboxQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("inbox"))
    .where("isDeleted", "is", null)
    .orderBy("createdAt", "asc"),
);
evolu.loadQuery(inboxQuery);

const doneQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("done"))
    .where("isDeleted", "is", null)
    .orderBy("updatedAt", "desc"),
);
evolu.loadQuery(doneQuery);

const notesQuery = evolu.createQuery((db) =>
  db
    .selectFrom("note")
    .select(["id", "content", "status"])
    .where("isDeleted", "is", null)
    .orderBy("createdAt", "asc"),
);
evolu.loadQuery(notesQuery);

export default function MobileInboxTab() {
  const [doneOpen, setDoneOpen] = useState(false);
  const inboxRows = useQuerySubscription(inboxQuery);
  const doneRows = useQuerySubscription(doneQuery);
  const allNoteRows = useQuerySubscription(notesQuery);
  const noteRows = allNoteRows.filter((r) => r.status === "new");

  return (
    <div className="pb-24">
      <div className="px-2 pt-2">
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
          <p className="text-sm text-ink/30 text-center py-10">Inbox je prázdný</p>
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
      </div>

      {doneRows.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setDoneOpen((v) => !v)}
            className="w-full text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink/40 flex items-center gap-1 border-b border-ink/5"
          >
            <span>{doneOpen ? "▼" : "►"}</span>
            <span>Hotovo ({doneRows.length})</span>
          </button>
          {doneOpen && (
            <div className="px-2">
              {doneRows.map((row) => (
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
      )}
    </div>
  );
}
