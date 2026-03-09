import { useState } from "react";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { TaskId, TimeBlockId } from "../../db/schema";
import { DRAG_DATA_KEY, DragPayload } from "../../constants";
import TaskItem from "../inbox/TaskItem";
import AddTaskInput from "../inbox/AddTaskInput";
import NowBlock from "./NowBlock";
import UpcomingList from "./UpcomingList";
import TwoDayCalendar from "./TwoDayCalendar";
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

export default function DashboardLayout() {
  const [doneOpen, setDoneOpen] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const { update } = useEvolu();

  const inboxRows = useQuery(inboxTasksQuery);
  const doneRows = useQuery(doneTasksQuery);

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
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div
        className={`w-80 flex flex-col overflow-y-auto border-r border-[#1a1a2e]/10 shrink-0 transition-colors ${dropHover ? "bg-green-50 border-green-300" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* NowBlock */}
        <NowBlock />

        {/* Inbox section */}
        <div className="mx-3 mb-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#1a1a2e]/40 px-1 mb-1">
            Inbox
          </div>
          {inboxRows.length === 0 && (
            <p className="text-xs text-[#1a1a2e]/30 text-center py-4">Žádné úkoly</p>
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

        {/* Upcoming */}
        <UpcomingList />

        {/* Projects placeholder */}
        <div className="mx-3 mb-3 px-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#1a1a2e]/40 mb-1">
            Projekty
          </div>
          <p className="text-xs text-[#1a1a2e]/30">Projekty (brzy)</p>
        </div>

        {/* Done section */}
        {doneRows.length > 0 && (
          <div className="mx-3 mb-3">
            <button
              onClick={() => setDoneOpen((v) => !v)}
              className="w-full text-left px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#1a1a2e]/40 hover:text-[#1a1a2e]/60 flex items-center gap-1"
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

      {/* Right panel — TwoDayCalendar */}
      <TwoDayCalendar />
    </div>
  );
}
