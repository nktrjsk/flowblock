# Changelog

All notable changes to FlowBlock are documented here.

## [0.1.0] — unreleased

### Added
- **Inbox** — capture tasks and quick notes (`//` prefix) without friction
- **Quick notes** — standalone note entity, convert to task or archive from inbox
- **Time-blocking calendar** — week view and 2-day (today/tomorrow) dashboard view
- **Drag & drop** — drag tasks from inbox onto calendar; drag time blocks to reschedule; drag blocks back to inbox to unschedule
- **Time block resize** — drag bottom edge to extend or shorten a block
- **Time block detail popover** — edit title, start/end time, priority; keyboard-navigable
- **Delete confirm dialog** — inline confirm when deleting a time block (`Del` shortcut)
- **Shortcut hints** — optional `Del` / `Ctrl+↵` labels on buttons (toggle in Settings)
- **Priority system** — none / low / medium / high, color-coded across all views
- **Capacity bar** — per-day visual load indicator in week view
- **Transition buffers** — configurable breathing room (5/10/15 min) between blocks, shown as hatched zones
- **External calendars** — overlay read-only events from ICS feeds or CalDAV servers (Basic Auth)
- **CORS proxy** — configurable proxy URL for ICS fetches blocked by CORS
- **Device sync** — opt-in E2E encrypted sync via Evolu relay; configurable relay URL
- **Owner key export/import** — backup and restore identity across devices
- **Reset local data** — wipe all local data and generate a new identity
- **Dark mode** — light / dark / system toggle; warm paper-industrial palette
- **Time format** — 24h or AM/PM toggle
- **Notifications** — browser notifications 5 minutes before a block ends
- **Mobile layout** — basic today + inbox tab view for small screens
- **Graceful private-browsing fallback** — informative message when OPFS is unavailable
