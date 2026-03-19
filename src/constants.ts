export const PRIORITY_COLORS = {
  high:   { bg: "#fee2e2", border: "#f87171", text: "#991b1b" },
  medium: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  low:    { bg: "#dbeafe", border: "#60a5fa", text: "#1e3a8a" },
  none:   { bg: "#f1f5f9", border: "#94a3b8", text: "#334155" },
} as const;

export const PRIORITY_COLORS_DARK = {
  high:   { bg: "#4a2222", border: "#f87171", text: "#fca5a5" },
  medium: { bg: "#493614", border: "#f59e0b", text: "#fcd34d" },
  low:    { bg: "#1e2d4a", border: "#60a5fa", text: "#93c5fd" },
  none:   { bg: "#2a2c45", border: "#475569", text: "#94a3b8" },
} as const;

export type Priority = keyof typeof PRIORITY_COLORS;

export const HOUR_HEIGHT_PX = 64; // px per hour
export const SNAP_MINUTES = 15;
export const SNAP_PX = (SNAP_MINUTES / 60) * HOUR_HEIGHT_PX; // 12px

export const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 24;
export const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
export const GRID_HEIGHT_PX = DAY_END_HOUR * HOUR_HEIGHT_PX; // 1152px

export const DRAG_DATA_KEY = "application/flowblock";

export const NOTIFICATION_LEAD_MINUTES = 5;
export const NOTIFICATIONS_ENABLED_KEY = "flowblock_notifications";
export const TRANSITION_BUFFER_KEY = "flowblock_transition_buffer"; // "0" | "5" | "10" | "15"
export const SHORTCUT_HINTS_KEY = "flowblock_shortcut_hints"; // "true" | "false", default true

export type DragPayload =
  | { type: "task"; taskId: string }
  | { type: "timeblock"; timeBlockId: string; offsetMinutes: number; taskId?: string };

export function isDragPayload(x: unknown): x is DragPayload {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  if (p.type === "task") return typeof p.taskId === "string";
  if (p.type === "timeblock") return typeof p.timeBlockId === "string" && typeof p.offsetMinutes === "number";
  return false;
}
