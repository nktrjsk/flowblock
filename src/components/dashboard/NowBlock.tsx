import { useNowAndNext } from "../../hooks/useNowAndNext";
import { useTimeFormat, formatIso } from "../../contexts/TimeFormatContext";

export default function NowBlock() {
  const { timeFormat } = useTimeFormat();
  const { current, next, progressPct, remainingMin } = useNowAndNext();

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
