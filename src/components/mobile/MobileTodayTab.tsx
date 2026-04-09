import { useNowAndNext } from "../../hooks/useNowAndNext";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MobileTodayTab() {
  const { now, todayBlocks, current, next, progressPct, remainingMin } = useNowAndNext();

  const borderColor = current ? "#22c55e" : next ? "#f97316" : "#94a3b8";

  return (
    <div className="pb-24">
      {/* Now card */}
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
