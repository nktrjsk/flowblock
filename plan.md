# FlowBlock — Aktuální plán

## Aktuálně:

### Velký refactor (audit z 2026-04-08, codebase-guardian)

- [ ] **R1** — `src/db/queries.ts` jako single source pro Evolu queries
  - [x] Krok 1: `allTimeBlocksQuery` + refactor čtenářských komponent (commit `65913df`)
  - [x] Krok 2: `allTasksQuery`, `allNotesQuery`, `allRecurringTemplatesQuery` + refactor SidePanel, MobileInboxTab, SettingsModal (commit `d9f3f3a`)
  - [x] Krok 3: refactor CalendarGrid + TimeBlockPopover na centralizované queries
  - [ ] Krok 4: refactor hooks (useDayRollover, useBlockTransitionNotifications, useCalendarSync, useRoutineGenerator)
- [ ] **R11** — doménové typy místo `NonEmptyString100` na status/priority/energy — **odloženo**: priority systém se bude přepracovávat
- [ ] **Subscription race při mountu** — `useQuerySubscription` občas vrací prázdné pole na první 1-2 rendery. Potenciálně vyřešitelné dokončením R1.

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
