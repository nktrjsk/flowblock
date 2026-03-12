import { Suspense, useState, useEffect, useRef } from "react";
import { EvoluProvider } from "@evolu/react";
import { evolu } from "./db/evolu";
import Header from "./components/layout/Header";
import SidePanel from "./components/layout/SidePanel";
import WeekCalendar from "./components/calendar/WeekCalendar";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import MobileLayout from "./components/mobile/MobileLayout";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { useIsMobile } from "./hooks/useIsMobile";
import { useCalendarSync } from "./hooks/useCalendarSync";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function AppContent() {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<"dashboard" | "week">("dashboard");
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const { show } = useToast();

  const { syncing, errors, syncNow } = useCalendarSync();
  const prevErrorsRef = useRef<Record<string, string>>({});

  // Show error toasts when background polling errors change
  useEffect(() => {
    const prev = prevErrorsRef.current;
    for (const [calId, msg] of Object.entries(errors)) {
      if (prev[calId] !== msg) {
        const short = msg.length > 80 ? msg.slice(0, 77) + "…" : msg;
        show(`Sync selhal: ${short}`, { type: "error" });
      }
    }
    prevErrorsRef.current = errors;
  }, [errors, show]);

  const hasSyncErrors = Object.keys(errors).length > 0;

  function goPrevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function goNextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  if (isMobile) return <MobileLayout />;

  return (
    <div className="flex flex-col h-screen bg-[#f5f0e8] text-[#1a1a2e] overflow-hidden">
      <Header
        viewMode={viewMode}
        onViewChange={setViewMode}
        weekStart={weekStart}
        onPrevWeek={goPrevWeek}
        onNextWeek={goNextWeek}
        syncing={syncing}
        onSyncNow={syncNow}
        hasSyncErrors={hasSyncErrors}
        syncErrors={errors}
      />
      {viewMode === "dashboard" ? (
        <DashboardLayout />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <SidePanel />
          <WeekCalendar weekStart={weekStart} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <EvoluProvider value={evolu}>
      <ToastProvider>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-[#f5f0e8] text-[#1a1a2e]/40 text-sm">
              Načítání…
            </div>
          }
        >
          <AppContent />
        </Suspense>
      </ToastProvider>
    </EvoluProvider>
  );
}
