import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@evolu/react";
import { evolu } from "../db/evolu";
import { syncCalendar } from "../services/calendarSync";
import { CalendarId } from "../db/schema";

const ICS_POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const calendarsQuery = evolu.createQuery((db) =>
  db
    .selectFrom("calendar")
    .select(["id", "type", "url", "username", "password"])
    .where("isDeleted", "is", null),
);

export function useCalendarSync(): {
  lastSyncAt: Date | null;
  syncing: boolean;
  errors: Record<string, string>;
  syncNow: () => void;
} {
  const calendars = useQuery(calendarsQuery);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Keep a stable ref to calendars for use in interval callback
  const calendarsRef = useRef(calendars);
  calendarsRef.current = calendars;

  const runSync = useCallback(async () => {
    const current = calendarsRef.current;
    if (!current.length) return;

    setSyncing(true);
    const newErrors: Record<string, string> = {};

    await Promise.allSettled(
      current.map(async (cal) => {
        try {
          await syncCalendar({
            id: cal.id as CalendarId,
            type: cal.type,
            url: cal.url,
            username: cal.username,
            password: cal.password,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          newErrors[cal.id] = msg;
          console.warn(`[CalendarSync] Chyba pro kalendář ${cal.id}:`, msg);
        }
      }),
    );

    setErrors(newErrors);
    setLastSyncAt(new Date());
    setSyncing(false);
  }, []);

  // Initial sync on mount
  useEffect(() => {
    runSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling interval for ICS calendars (and CalDAV too for simplicity)
  useEffect(() => {
    const id = setInterval(runSync, ICS_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runSync]);

  return { lastSyncAt, syncing, errors, syncNow: runSync };
}
