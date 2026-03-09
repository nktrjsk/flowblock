import { useState } from "react";
import SettingsModal from "../settings/SettingsModal";

interface HeaderProps {
  viewMode: "dashboard" | "week";
  onViewChange: (mode: "dashboard" | "week") => void;
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startStr = weekStart.toLocaleDateString("cs-CZ", opts);
  const endStr = weekEnd.toLocaleDateString("cs-CZ", opts);
  const year = weekEnd.getFullYear();
  return `${startStr} – ${endStr} ${year}`;
}

export default function Header({
  viewMode,
  onViewChange,
  weekStart,
  onPrevWeek,
  onNextWeek,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="h-14 flex items-center px-4 gap-3 border-b border-[#1a1a2e]/10 bg-[#f5f0e8] shrink-0">
      <h1 className="font-serif italic text-xl text-[#1a1a2e] mr-2">
        FlowBlock
      </h1>
      <div className="w-px h-5 bg-[#1a1a2e]/20" />
      {/* View toggle */}
      <button
        onClick={() => onViewChange("dashboard")}
        className={`px-3 py-1 text-sm rounded-md border transition-colors ${
          viewMode === "dashboard"
            ? "border-[#1a1a2e]/40 bg-[#1a1a2e]/10 font-semibold"
            : "border-[#1a1a2e]/20 hover:bg-[#1a1a2e]/5"
        }`}
      >
        Dnes
      </button>
      <button
        onClick={() => onViewChange("week")}
        className={`px-3 py-1 text-sm rounded-md border transition-colors ${
          viewMode === "week"
            ? "border-[#1a1a2e]/40 bg-[#1a1a2e]/10 font-semibold"
            : "border-[#1a1a2e]/20 hover:bg-[#1a1a2e]/5"
        }`}
      >
        Týden
      </button>
      {/* Week navigation — only in week view */}
      {viewMode === "week" && (
        <>
          <div className="w-px h-5 bg-[#1a1a2e]/20" />
          <button
            onClick={onPrevWeek}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-[#1a1a2e]/20 hover:bg-[#1a1a2e]/5 transition-colors text-sm"
          >
            ◄
          </button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {formatWeekRange(weekStart)}
          </span>
          <button
            onClick={onNextWeek}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-[#1a1a2e]/20 hover:bg-[#1a1a2e]/5 transition-colors text-sm"
          >
            ►
          </button>
        </>
      )}
      <div className="ml-auto">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-[#1a1a2e]/20 hover:bg-[#1a1a2e]/5 transition-colors text-sm"
          title="Nastavení"
        >
          ⚙
        </button>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
