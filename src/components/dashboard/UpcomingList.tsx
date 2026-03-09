import { useQuery } from "@evolu/react";
import { evolu } from "../../db/evolu";

const timeBlocksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("timeBlock")
    .select(["id", "title", "start", "end"])
    .where("isDeleted", "is", null)
    .orderBy("start", "asc"),
);

type Row = { id: string; title: string | null; start: string | null; end: string | null };

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function UpcomingList() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const allRows = useQuery(timeBlocksQuery) as unknown as Row[];

  const upcoming = allRows
    .filter((b) => {
      if (!b.start) return false;
      const s = new Date(b.start);
      return s > now && s >= today && s <= todayEnd;
    })
    .slice(0, 5);

  return (
    <div className="mx-3 mb-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#1a1a2e]/40 mb-1 px-1">
        Nadcházející
      </div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-[#1a1a2e]/30 px-1 py-2">Dnes nic dalšího</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {upcoming.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#1a1a2e]/5"
            >
              <span className="text-xs text-[#1a1a2e]/50 shrink-0 w-10">
                {b.start ? formatTime(b.start) : ""}
              </span>
              <span className="text-xs text-[#1a1a2e] truncate">{b.title ?? "Blok"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
