import { useState } from "react";
import { useQuerySubscription } from "@evolu/react";
import { evolu } from "../../db/evolu";
import DayCapacityBars from "../calendar/DayCapacityBars";
import MobileInboxTab from "./MobileInboxTab";
import MobileTodayTab from "./MobileTodayTab";
import QuickAddSheet from "./QuickAddSheet";
import SettingsModal from "../settings/SettingsModal";

const timeBlocksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("timeBlock")
    .select(["id", "start", "end"])
    .where("isDeleted", "is", null),
);
evolu.loadQuery(timeBlocksQuery);

function getTodayPlannedMinutes(
  rows: { id: string; start: string | null; end: string | null }[],
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  return rows
    .filter((b) => {
      if (!b.start) return false;
      const s = new Date(b.start);
      return s >= today && s <= todayEnd;
    })
    .reduce((sum, b) => {
      if (!b.start || !b.end) return sum;
      return sum + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000);
    }, 0);
}

type Tab = "inbox" | "today";

export default function MobileLayout() {
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const blockRows = useQuerySubscription(timeBlocksQuery);
  const plannedMinutes = getTodayPlannedMinutes(
    blockRows as unknown as { id: string; start: string | null; end: string | null }[],
  );

  return (
    <div className="flex flex-col h-dvh bg-paper text-ink overflow-hidden">
      {/* Top bar */}
      <header className="h-12 flex items-center px-4 border-b border-ink/10 shrink-0">
        <h1 className="font-serif italic text-xl text-ink flex-1">FlowBlock</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-ink/20 hover:bg-ink/5 transition-colors text-sm"
          title="Nastavení"
        >
          ⚙
        </button>
      </header>

      {/* Capacity bars — today only */}
      <div className="px-2 py-2 border-b border-ink/10 shrink-0">
        <DayCapacityBars plannedMinutes={plannedMinutes} />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "inbox" ? <MobileInboxTab /> : <MobileTodayTab />}
      </div>

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-ink text-paper text-2xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Přidat úkol"
      >
        +
      </button>

      {/* Bottom tab bar */}
      <nav className="h-14 flex border-t border-ink/10 bg-paper shrink-0">
        {(["inbox", "today"] as Tab[]).map((tab) => {
          const label = tab === "inbox" ? "Inbox" : "Dnes";
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                isActive
                  ? "text-ink font-semibold"
                  : "text-ink/40"
              }`}
            >
              <span className={`text-base ${isActive ? "opacity-100" : "opacity-40"}`}>
                {tab === "inbox" ? "📥" : "📅"}
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* Quick-add sheet */}
      {sheetOpen && <QuickAddSheet onClose={() => setSheetOpen(false)} />}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} syncErrors={{}} />}
    </div>
  );
}
