# FlowBlock — Aktuální plán

## Aktuálně:

### Velký refactor (audit z 2026-04-08, codebase-guardian)

**První sprint — low risk, high ROI:**
- [x] **R4** — `TimeBlockPopover.handleSave` slučit 4× `update("timeBlock")` do jednoho volání (commit `bdf7d12`)
- [x] **R2** — `src/lib/time.ts` sjednotit duplicitní time utility (commit `59bb614`)
- [x] **R7** — extract `computeCollisionLayout` do `src/lib/calendarLayout.ts` + 11 vitest testů (commit `b332f09`)
- [ ] **R1** — `src/db/queries.ts` jako single source pro Evolu queries
  - [ ] Krok 1: `allTimeBlocksQuery` + refactor čtenářských komponent (NowBlock, UpcomingList, MobileTodayTab, MobileLayout) — implementováno, stashnuto v `git stash@{0}`, čeká na vyřešení ProtocolQuotaError
  - [ ] Krok 2: `allTasksQuery`, `allNotesQuery` + refactor SidePanel, MobileInboxTab, SettingsModal
  - [ ] Krok 3: refactor CalendarGrid + TimeBlockPopover na centralizované queries
  - [ ] Krok 4: refactor hooks (useDayRollover, useBlockTransitionNotifications, useCalendarSync, useRoutineGenerator)
- [x] **R3** — `useNowAndNext()` hook (odstraní duplicitu z NowBlock, MobileTodayTab, useBlockTransitionNotifications) (commit `3554f50`)

**Druhý sprint — středně risk, vysoká hodnota:**
- [x] **R5** — extract `CalendarsSection` z `SettingsModal` (commit `0053f4a`)
- [x] **R6** — extract `useCalendarDnd` + `useNewBlockDrag` z `CalendarGrid` (681 → 370 ř.) (commit `90cdcc9`)
- [x] **R8** — service vrstva `src/services/timeBlocks.ts`, `tasks.ts` (commit `b6c5737`)

**Třetí sprint — vyšší risk, specifická hodnota:**
- [x] **R9** — `TimeBlockPopover` (631 ř.) rozdělit + form state přes useReducer (commit `7d97ed1`)
- [x] **R10** — `useRoutineGenerator` → `services/routineGenerator.ts` (commit `a38c767`)
- [ ] **R11** — doménové typy místo `NonEmptyString100` na status/priority/energy — **odloženo**: priority systém se bude přepracovávat, dělat před tím nemá smysl

**Velké rozhodnutí:**
- [x] **R12** — settings/preferences do Evolu místo localStorage: time_format, shortcut_hints, cors_proxy (commit `4ed6a0b`)

### Známé blockery / issues
- [ ] **ProtocolQuotaError** — Evolu sync narazil na quota limit (2026-04-08). Workaround: vypnout sync přes `localStorage.setItem("flowblock_sync_enabled", "false")`. Nutné vyšetřit, jaká mutace překračuje limit.
- [ ] **Subscription race při mountu** — `useQuerySubscription` občas vrací prázdné pole na první 1-2 rendery (viz MEMORY.md). Potenciálně vyřešitelné centralizací queries v R1.

---

## Feature: Recurring Blocks (opakující se TimeBlocky)

> Stav: implementováno (buggy — správa šablon potřebuje refaktor)

### Hotovo
- [x] Datový model: tabulka `RecurringTemplate`, `TimeBlock.recurring_template_id`
- [x] Generátor `useRoutineGenerator` — denní generování, okno today + 6 dní
- [x] Pevná vs. flexibilní šablona (`is_fixed_time`)
- [x] Výjimky: smazání bloku = přeskočení jen pro daný den (šablona zůstává aktivní)
- [x] Deduplication: samoopravný mechanismus při paralelním běhu generátoru
- [x] Vizuální odlišení: dashed border + ikona `Repeat`
- [x] Onboarding: "Opakovat tento blok" v detail popovert TimeBlocku
- [x] Mini-formulář: výběr frekvence (daily / weekdays / custom) + fixed/flexible toggle
- [x] Správa šablon v Nastavení → záložka "Recurring Blocks" (Vypnout/Zapnout/Smazat)
- [x] SPEC: zapsáno do SPEC.md jako sekce 10 (v0.29.0)

### Backlog
- [ ] Správa šablon — kompletní refaktor (editace šablony, spolehlivější reaktivita)
- [ ] Pasivní nabídka deaktivace šablony po opakovaném smazání (threshold TBD)
- [ ] Onboarding z ExternalEventu: "Opakovat tento blok" na CalDAV/ICS eventu + živý odkaz
- [ ] Placeholder "Event z kalendáře dnes chybí" když live-link event nenalezen
- [ ] UX: "odmítnutí bloku" — vygenerovaný blok je nejdřív "temporary" (dashed border), vedle něj tlačítka ✓ a ✗; odsouhlasení = stane se normálním blokem (s ikonou Rutina), zamítnutí = zmizí pro daný den

---

## Feature: Routines (checklist kroků v rámci bloku)

> Stav: návrh, nespuštěno

Odlišná feature od Recurring Blocks. Řeší obsah uvnitř bloku, ne opakování v čase.

**Pojmenování:**
- `Recurring Block` — blok v kalendáři generovaný šablonou
- `Routine` — pojmenovaná sada kroků (Routine Steps) navázaná na šablonu
- `Routine Step` — jedna položka checklistu (ne "task", ne "sub-task")

**UX — sidebar sekce:**
```
[Inbox]  [Routines]
────────────────────
RANNÍ RUTINA  07:00–07:30
☐  Sklenice vody
☐  Něco malého sníst
☐  10–15 min pohyb
☑  Otevřít FlowBlock
```
- Zobrazuje rutiny relevantní pro dnešek (dle `recurrence_days` šablony)
- Zaškrtnutý stav se resetuje každý den — localStorage, žádná DB persistence
- Žádný "FAILED" stav, žádný streak counter
- Satisfying animace po zaškrtnutí kroku (sem patří `completed` flag na TimeBlock)
- Mobilní varianta: overlay karta

**Datový model (additivní):**

Nová tabulka `RoutineStep`:
| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | PK |
| `template_id` | RecurringTemplateId | Reference na šablonu |
| `title` | NonEmptyString1000 | Text kroku |
| `order` | Int | Pořadí v checklistu |

---

## Drobnosti / UX opravy
- [ ] V popoveru ukládat při každé změně (resp. při opuštění focusu u text fieldu) — ne až po explicitním potvrzení

---

## Backlog / nápady
- [ ] **ProtocolQuotaError — root fix**: `externalEvent` rows are a cache of external CalDAV/ICS data — they don't need to be synced via Evolu relay (each device can re-fetch from source). Moving externalEvents out of Evolu (local state or non-synced store) would eliminate the main source of relay quota pressure.
- [ ] Podpora second relaye pro Evolu
- [ ] "Sidesidebar" pro různé módy (Planner, Review, Routines, …)
- [ ] **Evolu issue**: Kysely `.where("nullable_id_col", "=", brandedId as any)` ignoruje filtr — nutno filtrovat v JS. Nahlásit jako bug upstream.
- [ ] Prokonzultovat feature: **Denní bloky** — předdefinované časové zóny dne (např. Ranní práce 9–12h, Pauza 12–14h, Lehká práce 14–17h); vizuálně lehké, slouží jako rámec dne
