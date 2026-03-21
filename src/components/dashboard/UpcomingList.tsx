import { useState, useEffect } from "react";
import { useQuerySubscription } from "@evolu/react";
import { evolu } from "../../db/evolu";
import { useTimeFormat, formatIso } from "../../contexts/TimeFormatContext";

const timeBlocksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("timeBlock")
    .select(["id", "title", "start", "end"])
    .where("isDeleted", "is", null)
    .orderBy("start", "asc"),
);
evolu.loadQuery(timeBlocksQuery);

type Row = { id: string; title: string | null; start: string | null; end: string | null };

export default function UpcomingList() {
  const [now, setNow] = useState(() => new Date());
  const { timeFormat } = useTimeFormat();
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const allRows = useQuerySubscription(timeBlocksQuery) as unknown as Row[];

  const upcoming = allRows
    .filter((b) => {
      if (!b.start) return false;
      const s = new Date(b.start);
      return s > now && s >= today && s <= todayEnd;
    })
    .slice(0, 5);

  return (
    <div className="mx-3 mb-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-1 px-1">
        Nadcházející
      </div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-ink/30 px-1 py-2">Dnes nic dalšího</p>
      ) : (
        <div className="flex flex-col gap-1">
          {upcoming.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-ink/5"
            >
              <span className="text-xs text-ink/50 shrink-0 w-10">
                {b.start ? formatIso(b.start, timeFormat) : ""}
              </span>
              <span className="text-xs text-ink truncate">{b.title ?? "Blok"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
