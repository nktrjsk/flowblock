import { Clock, Zap } from "lucide-react";

const CAPACITY_MINUTES = 8 * 60; // 480 min = 8h

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function timeBarColor(pct: number): string {
  if (pct >= 0.8) return "#ef4444"; // red-500
  if (pct >= 0.5) return "#f59e0b"; // amber-500
  return "#22c55e"; // green-500
}

interface DayCapacityBarsProps {
  plannedMinutes: number;
}

export default function DayCapacityBars({ plannedMinutes }: DayCapacityBarsProps) {
  const timePct = Math.min(1, plannedMinutes / CAPACITY_MINUTES);
  const timeTooltip = `${formatHours(plannedMinutes)} / ${formatHours(CAPACITY_MINUTES)}`;

  // Energy bar is a placeholder — mock at 30% until energy feature is implemented
  const energyPct = 0.3;
  const energyTooltip = "Energie: nízká";

  return (
    <div className="flex flex-col gap-1.5 px-2 pb-2 w-full">
      {/* Time bar */}
      <div className="flex items-center gap-1.5" title={timeTooltip}>
        <Clock size={12} className="text-[#1a1a2e]/35 shrink-0" />
        <div className="flex-1 h-2.5 rounded-full bg-[#1a1a2e]/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${timePct * 100}%`,
              backgroundColor: timeBarColor(timePct),
            }}
          />
        </div>
      </div>
      {/* Energy bar (placeholder) */}
      <div className="flex items-center gap-1.5" title={energyTooltip}>
        <Zap size={12} className="text-[#1a1a2e]/35 shrink-0" />
        <div className="flex-1 h-2 rounded-full bg-[#1a1a2e]/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${energyPct * 100}%`,
              backgroundColor: "#a855f7", // purple-500
            }}
          />
        </div>
      </div>
    </div>
  );
}
