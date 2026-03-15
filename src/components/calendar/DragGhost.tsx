import { HOUR_HEIGHT_PX } from "../../constants";

interface DragGhostProps {
  startMinutes: number;
  durationMinutes: number;
  columnIndex: number;
  columnWidth: number;
  columnLeft: number;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function DragGhost({
  startMinutes,
  durationMinutes,
  columnIndex,
  columnWidth,
  columnLeft,
}: DragGhostProps) {
  const top = (startMinutes / 60) * HOUR_HEIGHT_PX;
  const height = (durationMinutes / 60) * HOUR_HEIGHT_PX;
  const left = columnLeft + columnIndex * columnWidth;
  const endMinutes = startMinutes + durationMinutes;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: columnWidth - 4,
        height,
        pointerEvents: "none",
        zIndex: 20,
      }}
      className="border-2 border-dashed border-ink/40 rounded-md bg-ink/8 flex items-start justify-end"
    >
      <span className="text-[10px] text-ink/60 bg-surface/80 rounded px-1 py-0.5 m-1 leading-none">
        {formatTime(startMinutes)}–{formatTime(endMinutes)}
      </span>
    </div>
  );
}
