import { useState, useEffect } from "react";
import { useQuerySubscription } from "@evolu/react";
import { allTimeBlocksQuery } from "../db/queries";

export type NowNextBlock = {
  id: string;
  title: string | null;
  start: string | null;
  end: string | null;
};

export function getTodayBlocks(
  rows: readonly { id: unknown; title: unknown; start: string | null; end: string | null }[],
): NowNextBlock[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  return (rows as NowNextBlock[]).filter((b) => {
    if (!b.start) return false;
    const s = new Date(b.start);
    return s >= today && s <= todayEnd;
  });
}

export interface NowAndNext {
  now: Date;
  todayBlocks: NowNextBlock[];
  current: NowNextBlock | undefined;
  next: NowNextBlock | undefined;
  progressPct: number;
  remainingMin: number;
}

export function useNowAndNext(): NowAndNext {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const allRows = useQuerySubscription(allTimeBlocksQuery);
  const todayBlocks = getTodayBlocks(allRows);

  const current = todayBlocks.find(
    (b) => b.start && b.end && new Date(b.start) <= now && now < new Date(b.end),
  );

  const next = todayBlocks
    .filter((b) => b.start && new Date(b.start) > now)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())[0];

  let progressPct = 0;
  let remainingMin = 0;
  if (current?.start && current?.end) {
    const startMs = new Date(current.start).getTime();
    const endMs = new Date(current.end).getTime();
    const durationMin = (endMs - startMs) / 60000;
    const elapsed = (now.getTime() - startMs) / 60000;
    progressPct = Math.min(100, Math.round((elapsed / durationMin) * 100));
    remainingMin = Math.max(0, Math.round(durationMin - elapsed));
  }

  return { now, todayBlocks, current, next, progressPct, remainingMin };
}
