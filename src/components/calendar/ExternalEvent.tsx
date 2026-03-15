import { HOUR_HEIGHT_PX } from "../../constants";
import { useTimeFormat, formatMinutes } from "../../contexts/TimeFormatContext";

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
        backgroundColor: "#f5f0e8",
        borderLeft: "3px dashed rgba(26,26,46,0.35)",
        borderRadius: "0 4px 4px 0",
        overflow: "hidden",
        opacity: 0.85,
      }}
    >
      <div className="px-1 py-0.5 leading-tight">
        {!isShort && (
          <div className="text-[9px] text-[#1a1a2e]/40 font-mono">
            {formatMinutes(startMinutes, timeFormat)}
          </div>
        )}
        <div className="text-[10px] text-[#1a1a2e]/55 italic truncate">
          {title}
        </div>
      </div>
    </div>
  );
}
