import { useState } from "react";
import { RefreshCw } from "lucide-react";
import SettingsModal from "../settings/SettingsModal";
import HelpModal from "../help/HelpModal";

interface HeaderProps {
  viewMode: "dashboard" | "week";
  onViewChange: (mode: "dashboard" | "week") => void;
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  syncing: boolean;
  onSyncNow: () => void;
  hasSyncErrors: boolean;
  syncErrors: Record<string, string>;
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
  syncing,
  onSyncNow,
  hasSyncErrors,
  syncErrors,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="h-14 flex items-center px-4 gap-3 border-b border-ink/10 bg-paper shrink-0">
      <h1 className="font-serif italic text-xl text-ink mr-2">
        FlowBlock
      </h1>
      <div className="w-px h-5 bg-ink/20" />
      {/* View toggle */}
      <button
        onClick={() => onViewChange("dashboard")}
        className={`px-3 py-1 text-sm rounded-md border transition-colors ${
          viewMode === "dashboard"
            ? "border-ink/40 bg-ink/10 font-semibold"
            : "border-ink/20 hover:bg-ink/5"
        }`}
      >
        Dnes
      </button>
      <button
        onClick={() => onViewChange("week")}
        className={`px-3 py-1 text-sm rounded-md border transition-colors ${
          viewMode === "week"
            ? "border-ink/40 bg-ink/10 font-semibold"
            : "border-ink/20 hover:bg-ink/5"
        }`}
      >
        Týden
      </button>
      {/* Week navigation — only in week view */}
      {viewMode === "week" && (
        <>
          <div className="w-px h-5 bg-ink/20" />
          <button
            onClick={onPrevWeek}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-ink/20 hover:bg-ink/5 transition-colors text-sm"
          >
            ◄
          </button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {formatWeekRange(weekStart)}
          </span>
          <button
            onClick={onNextWeek}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-ink/20 hover:bg-ink/5 transition-colors text-sm"
          >
            ►
          </button>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Sync button */}
        <div className="relative">
          <button
            onClick={onSyncNow}
            disabled={syncing}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-ink/20 hover:bg-ink/5 transition-colors disabled:opacity-50"
            title={syncing ? "Synchronizuji…" : "Synchronizovat kalendáře"}
          >
            <RefreshCw
              size={14}
              className={syncing ? "animate-spin" : ""}
            />
          </button>
          {/* Orange dot for background sync errors */}
          {hasSyncErrors && !syncing && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-400 border border-paper" />
          )}
        </div>

        {/* Help button */}
        <button
          onClick={() => setHelpOpen(true)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-ink/20 hover:bg-ink/5 transition-colors text-sm font-medium text-ink/60"
          title="Nápověda"
        >
          ?
        </button>

        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-ink/20 hover:bg-ink/5 transition-colors text-sm"
          title="Nastavení"
        >
          ⚙
        </button>
      </div>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          syncErrors={syncErrors}
        />
      )}
    </header>
  );
}
