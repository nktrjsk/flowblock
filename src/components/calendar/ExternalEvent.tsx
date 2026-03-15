import { HOUR_HEIGHT_PX } from "../../constants";
import { useTimeFormat, formatMinutes } from "../../contexts/TimeFormatContext";
import { useTheme } from "../../contexts/ThemeContext";

interface ExternalEventProps {
  title: string;
  startMinutes: number;
  durationMinutes: number;
}

export default function ExternalEvent({
  title,
  startMinutes,
  durationMinutes,
}: ExternalEventProps) {
  const { timeFormat } = useTimeFormat();
  const { effectiveTheme } = useTheme();
  const borderColor = effectiveTheme === "dark"
    ? "rgba(245,240,232,0.35)"
    : "rgba(26,26,46,0.35)";
  const top = (startMinutes / 60) * HOUR_HEIGHT_PX;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT_PX, 12);
  const isShort = height < 28;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 2,
        right: 2,
        height,
        zIndex: 5,
        pointerEvents: "none",
        borderLeft: `3px dashed ${borderColor}`,
        borderRadius: "0 4px 4px 0",
        overflow: "hidden",
        opacity: 0.85,
      }}
      className="bg-paper"
    >
      <div className="px-1 py-0.5 leading-tight">
        {!isShort && (
          <div className="text-[9px] text-ink/40 font-mono">
            {formatMinutes(startMinutes, timeFormat)}
          </div>
        )}
        <div className="text-[10px] text-ink/55 italic truncate">
          {title}
        </div>
      </div>
    </div>
  );
}
