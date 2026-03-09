import { useState } from "react";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { TaskId } from "../../db/schema";
import { PRIORITY_COLORS, Priority } from "../../constants";
import { useToast } from "../ui/Toast";
import * as Evolu from "@evolu/common";

const inboxQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("inbox"))
    .where("isDeleted", "is", null)
    .orderBy("createdAt", "asc"),
);

const doneQuery = evolu.createQuery((db) =>
  db
    .selectFrom("task")
    .select(["id", "title", "priority", "status", "energy", "waiting_for"])
    .where("status", "=", Evolu.NonEmptyString100.orThrow("done"))
    .where("isDeleted", "is", null)
    .orderBy("updatedAt", "desc"),
);

interface TaskRowProps {
  id: TaskId;
  title: string;
  priority: string | null;
  status: string;
  energy: string | null;
  waitingFor: string | null;
}

function TaskRow({ id, title, priority, status, energy, waitingFor }: TaskRowProps) {
  const { update } = useEvolu();
  const toast = useToast();
  const prio = (priority ?? "none") as Priority;
  const colors = PRIORITY_COLORS[prio] ?? PRIORITY_COLORS.none;

  function handleCheck() {
    const newStatus = status === "done" ? "inbox" : "done";
    update("task", { id, status: Evolu.NonEmptyString100.orThrow(newStatus) });
    if (newStatus === "done") toast.show("Hotovo! 🎉");
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-[#1a1a2e]/5 ${waitingFor != null ? "opacity-60" : ""}`}
    >
      {/* Priority dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: colors.border }}
      />
      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className="w-5 h-5 shrink-0 rounded border border-[#1a1a2e]/30 flex items-center justify-center"
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
      <span
        className={`flex-1 text-sm ${status === "done" ? "line-through text-[#1a1a2e]/40" : "text-[#1a1a2e]"}`}
      >
        {title}
      </span>
      {/* Energy icon */}
      {energy === "draining" && (
        <span className="text-xs opacity-60 shrink-0">⚡</span>
      )}
      {energy === "lite" && (
        <span className="text-xs opacity-60 shrink-0">☁</span>
      )}
    </div>
  );
}

export default function MobileInboxTab() {
  const [doneOpen, setDoneOpen] = useState(false);
  const inboxRows = useQuery(inboxQuery);
  const doneRows = useQuery(doneQuery);

  return (
    <div className="pb-24">
      {inboxRows.length === 0 && (
        <p className="text-sm text-[#1a1a2e]/30 text-center py-10">
          Inbox je prázdný
        </p>
      )}
      {inboxRows.map((row) => (
        <TaskRow
          key={row.id}
          id={row.id}
          title={row.title ?? ""}
          priority={row.priority}
          status={row.status ?? "inbox"}
          energy={row.energy}
          waitingFor={row.waiting_for}
        />
      ))}

      {doneRows.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setDoneOpen((v) => !v)}
            className="w-full text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1a1a2e]/40 flex items-center gap-1 border-b border-[#1a1a2e]/5"
          >
            <span>{doneOpen ? "▼" : "►"}</span>
            <span>Hotovo ({doneRows.length})</span>
          </button>
          {doneOpen &&
            doneRows.map((row) => (
              <TaskRow
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
