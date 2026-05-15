# FlowBlock — High-Level Design

**Version:** 0.1
**Status:** Draft
**Date:** 2026-04-14
**Source:** SPEC.md v0.29.0 → HLD

---

## 1. System Context

FlowBlock is a local-first, ADHD-friendly time-blocking planner that runs entirely in the browser. It combines a **unified inbox** (tasks and quick notes) with a **drag-and-drop calendar** for time-blocking, delivering a friction-free capture-and-plan loop without requiring an account or server. User data lives in a local SQLite database managed by Evolu; cross-device sync is opt-in and end-to-end encrypted. External calendars (CalDAV, ICS) are read-only bridges — FlowBlock never writes to them.

---

## 2. Component Map

```mermaid
graph TD
  subgraph Browser ["Browser (SPA / PWA)"]
    direction TB

    subgraph UI ["UI Layer"]
      Header
      Dashboard["Dashboard View\n(NowBlock · Inbox · Upcoming · DayColumns)"]
      WeekCal["Weekly Calendar View\n(InboxPanel · WeekCalendar)"]
      Mobile["Mobile Layout\n(InboxTab · TodayTab · RoutineOverlay)"]
      Settings["Settings Modal\n(Sync · Calendars · Appearance · Planning)"]
    end

    subgraph Logic ["App Logic (Hooks)"]
      useCalendarSync["useCalendarSync\n(polling every 30 min, syncNow)"]
      useRoutineGenerator["useRoutineGenerator\n(generates blocks from RecurringTemplates)"]
      useDayRollover["useDayRollover\n(midnight task migration)"]
      useBlockTransitions["useBlockTransitionNotifications\n(upcoming-block reminders)"]
    end

    subgraph DB ["Data Layer"]
      Queries["db/queries.ts\n(shared query definitions)"]
      Evolu["Evolu\n(SQLite · CRDT · OPFS)"]
    end

    subgraph Sync ["External Sync Layer"]
      CalendarSync["calendarSync.ts\n(fetchICS · fetchCalDAV REPORT)"]
      CORSProxy["CORS Proxy\n(optional · third-party or self-hosted)"]
    end
  end

  subgraph External ["External Systems"]
    EvoluRelay["Evolu Relay Server\n(WebSocket · E2E encrypted)"]
    CalDAVServer["CalDAV / ICS Servers\n(Nextcloud · Google · public feeds)"]
  end

  UI --> Logic
  UI --> Queries
  Logic --> Evolu
  Queries --> Evolu
  useCalendarSync --> CalendarSync
  CalendarSync --> CORSProxy
  CORSProxy --> CalDAVServer
  CalendarSync --> CalDAVServer
  CalendarSync --> Evolu
  Evolu <-->|"opt-in sync (wss://)"| EvoluRelay
```

### Components

| Component | Responsibility |
|---|---|
| **Dashboard View** | Default view: NowBlock (current/next time-block), Inbox, Upcoming, Projects, two narrow day-columns for planning |
| **Weekly Calendar View** | Full 5-day grid with Inbox panel left; primary surface for bulk planning |
| **Mobile Layout** | Touch-optimised two-tab layout (Inbox + Today) with FAB and bottom sheet for quick-add |
| **Settings Modal** | Sync toggle, Evolu identity (owner key export/import), custom relay URL, calendar management, appearance, planning preferences |
| **db/queries.ts** | Singleton `selectAll … where isDeleted is null` queries per table; shared across components to maximise subscription-cache reuse |
| **Evolu** | Local SQLite via OPFS, CRDT-based, E2E encrypted; the sole source of truth |
| **calendarSync.ts** | Fetches ICS feeds (HTTP) and CalDAV collections (REPORT request); upserts results as `ExternalEvent` rows in Evolu |
| **useCalendarSync** | Manages polling interval (30 min), exposes `syncNow()`, tracks per-calendar errors |
| **useRoutineGenerator** | Generates `TimeBlock` rows from active `RecurringTemplate` records at day rollover |
| **useDayRollover** | Detects midnight; migrates unfinished tasks silently (no "FAILED" state) |
| **useBlockTransitionNotifications** | Fires gentle reminders before upcoming block transitions |

---

## 3. Data Model

```mermaid
erDiagram
  Task {
    EvoluId id PK
    NonEmptyString1000 title
    String description
    Enum status
    Enum priority
    Date due_date
    Enum energy
    String waiting_for
    EvoluId project_id FK
    Timestamp created_at
    Timestamp updated_at
    SqliteBoolean isDeleted
  }

  TimeBlock {
    EvoluId id PK
    EvoluId task_id FK
    NonEmptyString1000 title
    Timestamp start
    Timestamp end
    Int buffer_before_minutes
    Int buffer_after_minutes
    Enum priority
    SqliteBoolean isDeleted
  }

  Calendar {
    EvoluId id PK
    Enum type
    String url
    String display_name
    String color
    String sync_token
    Timestamp last_fetched_at
    String username
    String password
    SqliteBoolean isDeleted
  }

  ExternalEvent {
    EvoluId id PK
    EvoluId calendar_id FK
    String caldav_uid
    String caldav_etag
    String title
    Timestamp start
    Timestamp end
    SqliteBoolean is_all_day
    SqliteBoolean isDeleted
  }

  Note {
    EvoluId id PK
    NonEmptyString1000 content
    Enum status
    EvoluId converted_task_id FK
    SqliteBoolean isDeleted
  }

  Project {
    EvoluId id PK
    NonEmptyString1000 name
    String color
    String description
    Float weight
    Timestamp created_at
    SqliteBoolean isDeleted
  }

  RecurringTemplate {
    EvoluId id PK
    NonEmptyString1000 title
    Enum energy
    Enum priority
    String preferred_time
    SqliteBoolean active
    SqliteBoolean isDeleted
  }

  Task ||--o{ TimeBlock : "linked to"
  Project ||--o{ Task : "contains"
  Calendar ||--o{ ExternalEvent : "sources"
  Note }o--o| Task : "converted to"
```

### Key Entities

| Entity | Role |
|---|---|
| **Task** | Unit of work; lifecycle: `inbox → planned → done` (or `someday`); never hard-deleted |
| **TimeBlock** | A scheduled slot on the calendar; may be linked to a Task or free-standing |
| **Note** | Lightweight capture (no priority/status/energy); lives in inbox until processed |
| **Calendar** | Config record for an ICS feed or CalDAV collection |
| **ExternalEvent** | Read-only mirror of external calendar events; never user-editable |
| **Project** | Optional grouping for Tasks with rotational weight (future feature) |
| **RecurringTemplate** | Defines a daily routine item; `useRoutineGenerator` materialises it into TimeBlocks |

**Soft-delete pattern:** All tables use `isDeleted: 0 | 1` (Evolu `SqliteBoolean`). Queries always filter `.where("isDeleted", "is", null)`.

---

## 4. Data Flow

### 4.1 Add task from Inbox

```mermaid
sequenceDiagram
  actor User
  User->>AddTaskInput: types text + Enter (or "//" prefix → task)
  AddTaskInput->>useQuickAdd: create(text, type)
  useQuickAdd->>Evolu: insert("task", { title, status: "inbox" })
  Evolu-->>useQuickAdd: { ok: true }
  useQuickAdd-->>AddTaskInput: done
  Evolu-->>InboxPanel: query subscription patch → re-render
```

### 4.2 Drag task → TimeBlock (planning)

```mermaid
sequenceDiagram
  actor User
  User->>InboxPanel: mousedown on TaskItem → drag starts
  InboxPanel->>DragGhost: render ghost at cursor
  User->>WeekCalendar: drag over calendar slot (15-min snap)
  WeekCalendar-->>User: drop-target highlight
  User->>WeekCalendar: drop on slot
  WeekCalendar->>Evolu: insert("timeBlock", { task_id, start, end, title })
  WeekCalendar->>Evolu: update("task", { id, status: "planned" })
  Evolu-->>WeekCalendar: subscription patch → TimeBlock appears
  Evolu-->>InboxPanel: subscription patch → task leaves inbox
```

### 4.3 External calendar sync cycle

```mermaid
sequenceDiagram
  participant Polling as useCalendarSync (30 min timer)
  participant Sync as calendarSync.ts
  participant Proxy as CORS Proxy (optional)
  participant Server as CalDAV / ICS Server
  participant DB as Evolu (ExternalEvents)

  Polling->>Sync: syncCalendar(calendar)
  alt ICS feed
    Sync->>Server: GET /feed.ics
    Server-->>Sync: iCalendar text
  else CalDAV
    Sync->>Proxy: REPORT /caldav/collection (if CORS blocked)
    Proxy->>Server: REPORT
    Server-->>Proxy: multistatus XML
    Proxy-->>Sync: multistatus XML
  end
  Sync->>Sync: parse VEVENT entries
  Sync->>DB: upsert ExternalEvents (caldav_uid as dedup key)
  DB-->>WeekCalendar: subscription patch → events rendered
```

---

## 5. Technology Choices

| Decision | Choice | Rationale | Alternatives considered |
|---|---|---|---|
| **UI framework** | React 18 + TypeScript | Component model fits complex drag & drop and subscription-driven reactivity | Svelte (less ecosystem), Vue (team unfamiliarity) |
| **Local database** | Evolu (SQLite via OPFS + CRDT) | Offline-first, E2E encrypted multi-device sync, no backend required | IndexedDB (no SQL), PGlite (no built-in sync), Dexie (no CRDT) |
| **Query builder** | Kysely (via Evolu) | Type-safe SQL on top of Evolu's SQLite layer | Raw SQL strings (no type safety) |
| **Styling** | Tailwind CSS | Utility-first, no runtime overhead, fast iteration | CSS Modules (verbose), styled-components (runtime cost) |
| **Drag & drop** | HTML5 Drag API (custom) | No external dependency; full control over ghost rendering and snap logic | dnd-kit (large bundle), react-beautiful-dnd (deprecated) |
| **Calendar parsing** | ical.js | Battle-tested RFC 5545 parser for ICS/CalDAV VEVENT processing | ics (limited), hand-rolled parser (error-prone) |
| **CalDAV fetch** | Browser `fetch` + optional CORS proxy | ICS feeds work directly; CalDAV requires CORS workaround | Server-side proxy (adds backend requirement) |
| **Multi-device sync transport** | Evolu relay (WebSocket, E2E) | Zero-config for users; optional, user-controlled relay URL | Firebase (vendor lock-in), custom WebSocket server (maintenance) |
| **Deployment** | Static SPA + PWA manifest | No backend to maintain; works on Vercel/Netlify/nginx; installable | SSR (unnecessary complexity for local-first) |
| **Build tool** | Vite | Fast HMR, native ESM, simple config | Webpack (slower), CRA (deprecated) |
| **Tests** | Vitest | Same config as Vite; already in use for `lib/calendarLayout.ts` | Jest (separate config), no tests (risky for date/layout logic) |

---

## 6. Non-Functional Requirements

| Concern | How addressed |
|---|---|
| **Offline-first** | Evolu stores all user data in browser OPFS SQLite; app loads and functions with no network. Sync is opt-in. |
| **Privacy** | No account, no server-side user data. Evolu relay receives only E2E-encrypted CRDT deltas — relay cannot read content. Owner key never leaves the device unless user exports it. |
| **Performance** | Shared singleton queries in `db/queries.ts` maximise Evolu subscription-cache reuse, reducing redundant SQLite reads. Layout-heavy computations (collision detection) are isolated in `lib/calendarLayout.ts` and tested. |
| **ADHD UX** | Task capture < 3 seconds (inline input, no modal). Progressive disclosure (priority, energy, description hidden until needed). Silent task migration at midnight. Satisfying animations/sounds on task completion. Capacity bars prevent over-scheduling. |
| **Accessibility** | Full keyboard navigation in calendar popover (Tab flow, arrow keys for segments, Ctrl+Enter to save). Delete key for destructive action with inline confirm. Focus trapping in modals. |
| **Installability** | PWA manifest + service worker for install-to-homescreen and offline shell caching. |
| **Self-hostability** | Pure static build; users can serve from any web server. Evolu relay URL is configurable in Settings. |
| **Security** | Credentials (CalDAV username/password) stored only in Evolu local SQLite (E2E encrypted if sync enabled). CORS proxy is user-configured, not bundled. |

---

## 7. Open Questions & Risks

- `[QUESTION]` CalDAV write (creating TimeBlocks and Tasks on external CalDAV servers) — not in MVP, but the architecture must not preclude it. Should `calendarSync.ts` be split into `calendarReader.ts` + `calendarWriter.ts` when write support is added?
- `[QUESTION]` CORS proxy strategy: public proxy (e.g. `corsproxy.io`) vs. user-provided vs. bundled lightweight proxy. Decision deferred; currently documented as "user configures a public CORS proxy URL in Settings".
- `[QUESTION]` PWA service worker scope: which assets to precache? What's the cache invalidation strategy on deploy?
- `[QUESTION]` RecurringTemplate → TimeBlock generation: at what point in the day? At midnight rollover? On first app open of the day? Edge case: app not opened for multiple days.
- `[RISK]` **Evolu ProtocolQuotaError** — bulk import of ExternalEvents (511 rows observed) may exceed Evolu relay quota. Mitigations: batch inserts, sync disabled by default (already the case). Root cause not yet confirmed.
- `[RISK]` **Evolu subscription race on mount** — `useQuerySubscription` may return empty arrays for 1–2 renders after app load, causing ExternalEvents to appear missing on first load. Workaround: force `evolu.loadQuery(query)` in component `useEffect`. Long-term fix: centralised query pre-loading before first render.
- `[RISK]` **CalDAV CORS** — majority of CalDAV servers block cross-origin browser requests. ICS feeds are the reliable path; CalDAV is best-effort until a proxy strategy is decided.
- `[RISK]` **OPFS availability** — Evolu uses OPFS for SQLite storage; OPFS requires a secure context (HTTPS) and may be blocked in some private browsing modes. App should degrade gracefully (in-memory fallback via Evolu's built-in handling).
- `[RISK]` **Drag & drop on touch** — HTML5 Drag API is not supported on iOS Safari and most mobile browsers. Mobile drag & drop planning is intentionally excluded from MVP scope (mobile is capture-only).

---

_Generated by hld-create skill. To update this document, use the hld-update skill._
