import { useState, useEffect } from "react";
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function NowCard({ now, todayBlocks }: { now: Date; todayBlocks: Row[] }) {
  const current = todayBlocks.find(
    (b) => b.start && b.end && new Date(b.start) <= now && now < new Date(b.end),
  );
  const next = todayBlocks
    .filter((b) => b.start && new Date(b.start) > now)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())[0];

  let progressPct = 0;
  let remainingMin = 0;
  if (current?.start && current?.end) {
    const startMs = new Date(current.start).getTime();
    const endMs = new Date(current.end).getTime();
    const durationMin = (endMs - startMs) / 60000;
    const elapsed = (now.getTime() - startMs) / 60000;
    progressPct = Math.min(100, Math.round((elapsed / durationMin) * 100));
    remainingMin = Math.max(0, Math.round(durationMin - elapsed));
  }

  const borderColor = current ? "#22c55e" : next ? "#f97316" : "#94a3b8";

  return (
    <div
      className="mx-4 my-3 p-4 rounded-xl bg-surface shadow-sm"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink/40 mb-1">
        Právě teď
      </div>
      {current ? (
        <>
          <div className="text-base font-semibold text-ink truncate">
            {current.title ?? "Blok"}
          </div>
          <div className="mt-2.5 h-2 rounded-full bg-ink/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs text-ink/40 mt-1">Zbývá {remainingMin} min</div>
        </>
      ) : next ? (
        <div className="text-sm text-ink/70">
          Další:{" "}
          <span className="font-semibold text-ink">{next.title ?? "Blok"}</span>
          {next.start && (
            <span className="text-ink/50"> v {formatTime(next.start)}</span>
          )}
        </div>
      ) : (
        <div className="text-sm text-ink/50">Volný čas</div>
      )}
    </div>
  );
}

export default function MobileTodayTab() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const allRows = useQuery(timeBlocksQuery) as unknown as Row[];
  const todayBlocks = getTodayBlocks(allRows);

  return (
    <div className="pb-24">
      <NowCard now={now} todayBlocks={todayBlocks} />

      {todayBlocks.length === 0 && (
        <p className="text-sm text-ink/30 text-center py-6">
          Dnes žádné bloky
        </p>
      )}

      <div className="mx-4 flex flex-col">
        {todayBlocks.map((block) => {
          const isCurrent =
            block.start &&
            block.end &&
            new Date(block.start) <= now &&
            now < new Date(block.end);

          return (
            <div key={block.id} className="flex items-start gap-3 py-3 border-b border-ink/5">
              {/* Dot indicator */}
              <div className="pt-0.5 shrink-0">
                {isCurrent ? (
                  <span className="block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.35)] animate-pulse" />
                ) : (
                  <span className="block w-2.5 h-2.5 rounded-full bg-amber-400" />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-ink/50 mb-0.5">
                  {block.start ? formatTime(block.start) : ""}
                  {block.end ? ` – ${formatTime(block.end)}` : ""}
                </div>
                <div className="text-sm font-medium text-ink truncate">
                  {block.title ?? "Blok"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
