import { useEffect } from "react";
import * as Evolu from "@evolu/common";
import { evolu } from "../db/evolu";
import { TimeBlockId, RecurringTemplateId } from "../db/schema";

const LAST_ROUTINE_GEN_KEY = "flowblock_last_routine_gen";
// Generate blocks for today + this many days ahead
const GENERATION_WINDOW_DAYS = 6;
// How far to search for a free slot for flexible routines (in 15-min steps)
const FLEXIBLE_MAX_SHIFT_MINUTES = 120;

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

function getTodayStr(): string {
  return localDateStr(new Date());
}

function getDateStr(date: Date): string {
  return localDateStr(date);
}

/** Returns ISO datetime string for a given date + "HH:MM" time. */
function buildDatetime(dateStr: string, timeHHMM: string): string {
  return `${dateStr}T${timeHHMM}:00`;
}

/** Adds minutes to a local ISO datetime string, returning a local ISO datetime string. */
function addMinutes(isoDatetime: string, minutes: number): string {
  const d = new Date(new Date(isoDatetime).getTime() + minutes * 60_000);
  return `${localDateStr(d)}T${padTwo(d.getHours())}:${padTwo(d.getMinutes())}:00`;
}

/** Returns day-of-week index where 0 = Monday … 6 = Sunday (matching recurrence_days convention). */
function getDayOfWeekMon0(date: Date): number {
  const js = date.getDay(); // 0 = Sunday
  return js === 0 ? 6 : js - 1;
}

/** Returns true if two [start, end) intervals overlap. */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

async function runRoutineGeneration() {
  const todayStr = getTodayStr();
  if (localStorage.getItem(LAST_ROUTINE_GEN_KEY) === todayStr) return;
  // Set immediately to prevent parallel runs (race condition guard)
  localStorage.setItem(LAST_ROUTINE_GEN_KEY, todayStr);

  // --- Load all non-deleted templates (active and inactive) ---
  const templatesQuery = evolu.createQuery((db) =>
    db
      .selectFrom("recurringTemplate")
      .selectAll()
      .where("isDeleted", "is", null),
  );

  // --- Load all timeBlocks in the generation window (including deleted, for skip detection) ---
  const windowStart = todayStr;
  const windowEnd = (() => {
    const d = new Date(todayStr);
    d.setDate(d.getDate() + GENERATION_WINDOW_DAYS + 1);
    return getDateStr(d);
  })();

  const allBlocksQuery = evolu.createQuery((db) =>
    db
      .selectFrom("timeBlock")
      .select(["id", "start", "end", "recurring_template_id", "isDeleted"])
      .where("start", ">=", windowStart)
      .where("start", "<", windowEnd),
  );

  // --- Load ExternalEvents in the window (for live link lookup) ---
  const externalEventsQuery = evolu.createQuery((db) =>
    db
      .selectFrom("externalEvent")
      .select(["id", "calendar_id", "caldav_uid", "title", "start", "end"])
      .where("isDeleted", "is", null)
      .where("start", ">=", windowStart)
      .where("start", "<", windowEnd),
  );

  const [templates, allBlocks, externalEvents] = await Promise.all([
    evolu.loadQuery(templatesQuery),
    evolu.loadQuery(allBlocksQuery),
    evolu.loadQuery(externalEventsQuery),
  ]);

  // Build set of active template IDs
  const activeTemplateIds = new Set<string>();
  for (const t of templates) {
    if ((t.active as number | null) === 1) activeTemplateIds.add(String(t.id));
  }

  // Deduplicate: if multiple non-deleted blocks share the same template+day, keep first, soft-delete the rest
  const slotBlockIds = new Map<string, string[]>();
  for (const block of allBlocks) {
    if (!block.recurring_template_id || !block.start || block.isDeleted) continue;
    const dateStr = (block.start as string).slice(0, 10);
    const key = `${block.recurring_template_id}::${dateStr}`;
    if (!slotBlockIds.has(key)) slotBlockIds.set(key, []);
    slotBlockIds.get(key)!.push(String(block.id));
  }
  for (const ids of slotBlockIds.values()) {
    for (const dupId of ids.slice(1)) {
      evolu.update("timeBlock", { id: dupId as unknown as TimeBlockId, isDeleted: 1 });
    }
  }

  // Build a set of "already handled" slots: `${templateId}::${dateStr}` (skip if any block exists, deleted or not)
  const handledSlots = new Set<string>();
  for (const block of allBlocks) {
    if (!block.recurring_template_id || !block.start) continue;
    const dateStr = (block.start as string).slice(0, 10);
    handledSlots.add(`${block.recurring_template_id}::${dateStr}`);
  }

  // Active (non-deleted) blocks per date for free-slot search
  const activeBlocksByDate = new Map<string, Array<{ start: string; end: string }>>();
  for (const block of allBlocks) {
    if (block.isDeleted || !block.start || !block.end) continue;
    const dateStr = (block.start as string).slice(0, 10);
    if (!activeBlocksByDate.has(dateStr)) activeBlocksByDate.set(dateStr, []);
    activeBlocksByDate.get(dateStr)!.push({ start: block.start as string, end: block.end as string });
  }

  // External events indexed by caldav_uid + calendar_id + date
  // Key: `${calendar_id}::${caldav_uid}::${dateStr}`
  const externalEventIndex = new Map<
    string,
    { title: string; start: string; end: string }
  >();
  for (const ev of externalEvents) {
    if (!ev.caldav_uid || !ev.calendar_id || !ev.start) continue;
    const dateStr = (ev.start as string).slice(0, 10);
    const key = `${ev.calendar_id}::${ev.caldav_uid}::${dateStr}`;
    externalEventIndex.set(key, {
      title: ev.title as string,
      start: ev.start as string,
      end: ev.end as string,
    });
  }

  // --- Generate blocks (active templates only) ---
  for (const template of templates) {
    if (!activeTemplateIds.has(String(template.id))) continue;
    const recurrence = template.recurrence as string | null;
    const recurrenceDays: number[] = (() => {
      if (recurrence === "daily") return [0, 1, 2, 3, 4, 5, 6];
      if (recurrence === "weekdays") return [0, 1, 2, 3, 4];
      if (recurrence === "custom" && template.recurrence_days) {
        try { return JSON.parse(template.recurrence_days as string); } catch { return []; }
      }
      return [];
    })();

    const durationMinutes = (template.duration_minutes as number | null) ?? 30;
    const preferredTime = (template.preferred_time as string | null) ?? "09:00";
    const isFixed = (template.is_fixed_time as number | null) === 1;
    const energy = (template.energy as string | null) ?? "normal";
    const title = (template.title as string | null) ?? "";
    const sourceCalendarId = template.source_calendar_id as string | null;
    const sourceEventUid = template.source_event_uid as string | null;

    for (let i = 0; i <= GENERATION_WINDOW_DAYS; i++) {
      const targetDate = new Date(todayStr);
      targetDate.setDate(targetDate.getDate() + i);
      const dateStr = getDateStr(targetDate);
      const dow = getDayOfWeekMon0(targetDate);

      if (!recurrenceDays.includes(dow)) continue;
      if (handledSlots.has(`${template.id}::${dateStr}`)) continue;

      // Determine start/end from live link or fallback
      let blockTitle = title;
      let blockStart: string;
      let blockEnd: string;

      const liveKey = sourceCalendarId && sourceEventUid
        ? `${sourceCalendarId}::${sourceEventUid}::${dateStr}`
        : null;
      const liveEvent = liveKey ? externalEventIndex.get(liveKey) : undefined;

      if (liveEvent) {
        blockTitle = liveEvent.title;
        blockStart = liveEvent.start;
        blockEnd = liveEvent.end;
      } else if (liveKey) {
        // Live link but event not found for this day — skip (don't generate)
        continue;
      } else {
        // No live link — use preferred_time
        blockStart = buildDatetime(dateStr, preferredTime);
        blockEnd = addMinutes(blockStart, durationMinutes);
      }

      // For flexible routines, find nearest free slot
      if (!isFixed && !liveEvent) {
        const dayBlocks = activeBlocksByDate.get(dateStr) ?? [];
        let shift = 0;
        while (shift <= FLEXIBLE_MAX_SHIFT_MINUTES) {
          const candidateStart = addMinutes(blockStart, shift);
          const candidateEnd = addMinutes(candidateStart, durationMinutes);
          const hasOverlap = dayBlocks.some((b) =>
            overlaps(candidateStart, candidateEnd, b.start, b.end)
          );
          if (!hasOverlap) {
            blockStart = candidateStart;
            blockEnd = candidateEnd;
            break;
          }
          shift += 15;
        }
        // If no free slot found within window, use original time (will show as collision)
      }

      evolu.insert("timeBlock", {
        title: Evolu.NonEmptyString1000.orThrow(blockTitle || "Rutina"),
        start: Evolu.NonEmptyString100.orThrow(blockStart),
        end: Evolu.NonEmptyString100.orThrow(blockEnd),
        recurring_template_id: template.id as RecurringTemplateId,
      });
    }
  }

}

/** Soft-deletes all non-deleted recurring blocks for a given template that haven't started yet. */
export async function deleteFutureBlocksForTemplate(templateId: RecurringTemplateId) {
  const now = new Date();
  const nowStr = `${localDateStr(now)}T${padTwo(now.getHours())}:${padTwo(now.getMinutes())}:00`;
  // Filter in JS to avoid Kysely type issues with nullable ID columns
  const query = evolu.createQuery((db) =>
    db
      .selectFrom("timeBlock")
      .select(["id", "start", "recurring_template_id"])
      .where("isDeleted", "is", null),
  );
  const blocks = await evolu.loadQuery(query);
  for (const block of blocks) {
    if (String(block.recurring_template_id) !== String(templateId)) continue;
    if (!block.start || String(block.start) <= nowStr) continue;
    evolu.update("timeBlock", { id: block.id as TimeBlockId, isDeleted: 1 });
  }
}

export function triggerRoutineGeneration() {
  localStorage.removeItem(LAST_ROUTINE_GEN_KEY);
  runRoutineGeneration();
}

export function useRoutineGenerator() {
  useEffect(() => {
    runRoutineGeneration();

    function handleVisibility() {
      if (!document.hidden) {
        localStorage.removeItem(LAST_ROUTINE_GEN_KEY);
        runRoutineGeneration();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
