import * as Evolu from "@evolu/common";

// --- Branded ID types ---
export const TaskId = Evolu.id("Task");
export type TaskId = typeof TaskId.Type;

export const TimeBlockId = Evolu.id("TimeBlock");
export type TimeBlockId = typeof TimeBlockId.Type;

export const CalendarId = Evolu.id("Calendar");
export type CalendarId = typeof CalendarId.Type;

export const ExternalEventId = Evolu.id("ExternalEvent");
export type ExternalEventId = typeof ExternalEventId.Type;

export const NoteId = Evolu.id("Note");
export type NoteId = typeof NoteId.Type;

export const RecurringTemplateId = Evolu.id("RecurringTemplate");
export type RecurringTemplateId = typeof RecurringTemplateId.Type;

// --- Domain types ---
// Status: "inbox" | "planned" | "done" | "someday"
// Priority: "none" | "low" | "medium" | "high"
// Energy: "normal" | "lite" | "draining"
// These are stored as NonEmptyString100 and validated at the app layer for now.

// --- Schema ---
export const Database = {
  task: {
    id: TaskId,
    title: Evolu.NonEmptyString1000,
    description: Evolu.nullOr(Evolu.String1000),
    // "inbox" | "planned" | "done" | "someday"
    status: Evolu.NonEmptyString100,
    // "none" | "low" | "medium" | "high"
    priority: Evolu.NonEmptyString100,
    due_date: Evolu.nullOr(Evolu.NonEmptyString100),
    // "normal" | "lite" | "draining"
    energy: Evolu.NonEmptyString100,
    waiting_for: Evolu.nullOr(Evolu.String1000),
    project_id: Evolu.nullOr(Evolu.NonEmptyString100),
  },
  timeBlock: {
    id: TimeBlockId,
    task_id: Evolu.nullOr(TaskId),
    title: Evolu.NonEmptyString1000,
    // ISO 8601 datetime strings
    start: Evolu.NonEmptyString100,
    end: Evolu.NonEmptyString100,
    // "none" | "low" | "medium" | "high" — block-level priority, overrides task priority
    priority: Evolu.nullOr(Evolu.NonEmptyString100),
    recurring_template_id: Evolu.nullOr(RecurringTemplateId),
    completed: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  calendar: {
    id: CalendarId,
    // "caldav" | "ics"
    type: Evolu.NonEmptyString100,
    url: Evolu.NonEmptyString1000,
    display_name: Evolu.NonEmptyString1000,
    color: Evolu.NonEmptyString100,
    sync_token: Evolu.nullOr(Evolu.NonEmptyString1000),
    last_fetched_at: Evolu.nullOr(Evolu.NonEmptyString100),
    username: Evolu.nullOr(Evolu.NonEmptyString1000),
    password: Evolu.nullOr(Evolu.NonEmptyString1000),
  },
  externalEvent: {
    id: ExternalEventId,
    calendar_id: CalendarId,
    caldav_uid: Evolu.NonEmptyString1000,
    caldav_etag: Evolu.nullOr(Evolu.NonEmptyString1000),
    title: Evolu.NonEmptyString1000,
    start: Evolu.NonEmptyString100,
    end: Evolu.NonEmptyString100,
    is_all_day: Evolu.SqliteBoolean,
  },
  recurringTemplate: {
    id: RecurringTemplateId,
    title: Evolu.NonEmptyString1000,
    duration_minutes: Evolu.PositiveInt,
    // "daily" | "weekdays" | "custom"
    recurrence: Evolu.NonEmptyString100,
    // JSON array of ints 0–6 (0=Mon, 6=Sun), used when recurrence = "custom"
    recurrence_days: Evolu.nullOr(Evolu.String1000),
    // "HH:MM" local time, used as fallback when live link has no event
    preferred_time: Evolu.nullOr(Evolu.NonEmptyString100),
    // true = fixed slot, false = flexible (find nearest free slot)
    is_fixed_time: Evolu.SqliteBoolean,
    // "normal" | "lite" | "draining"
    energy: Evolu.NonEmptyString100,
    active: Evolu.SqliteBoolean,
    // Live link to an ExternalEvent (optional)
    source_calendar_id: Evolu.nullOr(CalendarId),
    source_event_uid: Evolu.nullOr(Evolu.NonEmptyString1000),
  },
  note: {
    id: NoteId,
    content: Evolu.NonEmptyString1000,
    // "new" | "reviewed"
    status: Evolu.NonEmptyString100,
    converted_task_id: Evolu.nullOr(TaskId),
  },
} satisfies Evolu.EvoluSchema;

export type Database = typeof Database;
