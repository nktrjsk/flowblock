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

function getTodayBlocks(rows: Row[]): Row[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  return rows.filter((b) => {
    if (!b.start) return false;
    const s = new Date(b.start);
    return s >= today && s <= todayEnd;
  });
}

export default function NowBlock() {
  const [now, setNow] = useState(() => new Date());
  const { timeFormat } = useTimeFormat();
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const allRows = useQuerySubscription(timeBlocksQuery) as unknown as Row[];
  const todayBlocks = getTodayBlocks(allRows);

  const current = todayBlocks.find((b) => {
    if (!b.start || !b.end) return false;
    return new Date(b.start) <= now && now < new Date(b.end);
  });

  const next = todayBlocks
    .filter((b) => b.start && new Date(b.start) > now)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())[0];

  let progressPct = 0;
  let remainingMin = 0;
  if (current?.start && current?.end) {
    const startMs = new Date(current.start).getTime();
    const endMs = new Date(current.end).getTime();
    const durationMin = (endMs - startMs) / (1000 * 60);
    const elapsed = (now.getTime() - startMs) / (1000 * 60);
    progressPct = Math.min(100, Math.round((elapsed / durationMin) * 100));
    remainingMin = Math.max(0, Math.round(durationMin - elapsed));
  }

  const borderColor = current ? "#22c55e" : next ? "#f97316" : "#94a3b8";

  return (
    <div
      className="mx-3 my-3 p-3 rounded-lg bg-surface/60 shadow-sm"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-1">
        Co teď
      </div>
      {current ? (
        <>
          <div className="text-sm font-medium text-ink truncate">
            {current.title ?? "Blok"}
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-ink/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs text-ink/40 mt-1">
            Zbývá {remainingMin} min
          </div>
        </>
      ) : next ? (
        <div className="text-sm text-ink/70">
          Další:{" "}
          <span className="font-medium text-ink">{next.title ?? "Blok"}</span>
          {next.start && ` v ${formatIso(next.start, timeFormat)}`}
        </div>
      ) : (
        <div className="text-sm text-ink/50">Volný čas</div>
      )}
    </div>
  );
}
