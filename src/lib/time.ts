/**
 * Time utilities for calendar UI.
 *
 * These helpers produce/consume UTC ISO strings via `Date.toISOString()`.
 * Do NOT mix with the naive-local ISO strings used by the routine generator
 * (`YYYY-MM-DDTHH:MM:00` without `Z`) — those follow different semantics.
 */

/**
 * Converts day-local minutes since midnight to a UTC ISO string anchored at `date`.
 * Optionally shifts the day by `dayOffset` (used for blocks crossing midnight).
 */
export function dayMinutesToIso(date: Date, minutes: number, dayOffset = 0): string {
  const d = new Date(date);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toISOString();
}

/**
 * Converts a UTC ISO string to minutes since midnight of `referenceDate` (local time).
 * Can return values outside [0, 1440) for multi-day spans.
 */
export function isoToDayMinutes(iso: string, referenceDate: Date): number {
  const d = new Date(iso);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - ref.getTime()) / (1000 * 60));
}

/** Formats minutes since midnight as "HH:MM" (24-hour). */
export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
