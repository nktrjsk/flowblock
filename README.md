# FlowBlock

A local-first time-blocking planner built for ADHD brains.

Plan your day by dragging tasks into your calendar — no backend, no account required. Your data lives on your device.

![FlowBlock screenshot](TODO: add screenshot, e.g. docs/screenshot.png)

---

## Features

- **Inbox** — capture tasks in under 3 seconds, no friction
- **Time-blocking calendar** — week view and 2-day view
- **Drag & drop** — move tasks from inbox to calendar, resize blocks
- **Transition buffers** — automatic breathing room between blocks
- **CalDAV / ICS read** — overlay your existing calendar events
- **Quick notes** — prefix a task with `//` to create a lightweight note
- **Keyboard navigation** — operate the full UI without a mouse
- **Dark mode** — warm paper-industrial aesthetic, day and night
- **Notifications** — optional reminders for upcoming blocks
- **Local-first** — data stored in local SQLite, nothing sent to a server
- **Device sync** — opt-in sync via Evolu relay, end-to-end encrypted

---

## Stack

| Layer | Technology |
|---|---|
| UI | React + TypeScript |
| Build | Vite |
| Local DB + sync | [Evolu](https://www.evolu.dev/) (SQLite + CRDT, E2E encrypted) |
| Styling | Tailwind CSS |
| CalDAV / ICS | Custom fetch wrapper + ical.js |

No backend is required. Everything runs in the browser.

---

## Getting started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Install and run

```bash
git clone https://github.com/nktrjsk/flowblock.git
cd flowblock
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Deploy to any static host — GitHub Pages, Netlify, Vercel, etc.

---

## Deployment

### GitHub Pages

```bash
npm run build
# push dist/ to gh-pages branch, or use a GitHub Actions workflow
```

Live demo: [TODO: https://nktrjsk.github.io/flowblock]

---

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Save time block | `Ctrl+Enter` |
| Delete time block | `Del` |
| Close popover / cancel | `Escape` |

---

## Sync between devices

FlowBlock uses [Evolu](https://www.evolu.dev/) for optional device sync. Sync is:

- **End-to-end encrypted** — the relay server sees only ciphertext
- **CRDT-based** — conflicts resolve automatically, no merge dialogs
- **Opt-in** — if you never set up sync, your data never leaves your device

To sync, open **Settings → Identity** and copy your owner key to the second device.

---

## CalDAV / ICS

You can overlay read-only events from external calendars:

1. Open **Settings → Calendars**
2. Add an ICS feed URL or a CalDAV server
3. Events appear in the calendar as dashed blocks beneath your time blocks

> Note: most CalDAV servers block browser requests due to CORS. ICS feeds are a reliable alternative.

---

## Roadmap

- [ ] CalDAV write — sync time blocks back to CalDAV
- [ ] Projects — group tasks by project with rotational weight
- [ ] Energy capacity bar — plan by energy, not just time
- [ ] Routines — recurring time block templates
- [ ] Review mode — weekly retrospective view
- [ ] Smart suggestions — AI-assisted scheduling

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[WTFPL](LICENSE.md) — do what the fuck you want.
