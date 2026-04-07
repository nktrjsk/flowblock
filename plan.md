# FlowBlock — Aktuální plán

## Hotové bugy / drobnosti
- [x] Odstranit glowing ring při najetí timeblockem na timeblock
- [x] Při podržení na elementu tasku na mobilu se spawne desktop drag image a stuckne se tam

---

## Feature: Recurring Blocks (opakující se TimeBlocky)

> Stav: v implementaci

Blok v kalendáři, který se automaticky generuje podle šablony (`RecurringTemplate`).
Odmítnutelný jedním klikem, bez trestu, bez streak counteru.

### Co je hotové
- [x] Datový model: tabulka `RecurringTemplate`, `TimeBlock.recurring_template_id`
- [x] Generátor `useRoutineGenerator` — denní generování, okno today + 6 dní
- [x] Pevná vs. flexibilní šablona (`is_fixed_time`)
- [x] Výjimky: smazání bloku = přeskočení jen pro daný den (šablona zůstává aktivní)
- [x] Deduplication: samoopravný mechanismus při paralelním běhu generátoru
- [x] Vizuální odlišení: dashed border + ikona `Repeat`
- [x] Onboarding: "Opakovat tento blok" v detail popovert TimeBlocku
- [x] Mini-formulář: výběr frekvence (daily / weekdays / custom) + fixed/flexible toggle

### Zbývá
- [ ] Správa šablon v Nastavení → záložka "Recurring Blocks" (seznam, editace, smazání)
- [ ] Pasivní nabídka deaktivace šablony po opakovaném smazání (threshold TBD) — může počkat
- [ ] SPEC: schválit návrh níže, zapsat do SPEC.md

### Backlog (Recurring Blocks, nižší priorita)
- [ ] Onboarding z ExternalEventu: "Opakovat tento blok" na CalDAV/ICS eventu + živý odkaz (source_calendar_id + source_event_uid)
- [ ] Placeholder "Event z kalendáře dnes chybí" když live-link event nenalezen

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

## Backlog / nápady
- [ ] Podpora second relaye pro Evolu
- [ ] "Sidesidebar" pro různé módy (Planner, Review, Routines, …)
- [ ] **Evolu issue**: Kysely `.where("nullable_id_col", "=", brandedId as any)` ignoruje filtr — nutno filtrovat v JS. Nahlásit jako bug upstream.

---

## Návrh SPEC — Recurring Blocks

> Stav: čeká na schválení před zápisem do SPEC.md
> Navržená verze: 0.29.0

### Navrhovaný text sekce 10

---

## 10. Recurring Blocks (opakující se TimeBlocky)

### Problém

ADHD mozek potřebuje strukturu, ale streak-based systémy (Habitica, Streaks…) jsou
toxické: přerušíš streak → stud → vyhýbání se appce → konec. Rigidní denní povinnosti
demotivují.

### Řešení: opakující se bloky bez závazků

- **RecurringTemplate** — šablona definující opakující se TimeBlock (např. "Cvičení",
  "Standup", "Review inboxu")
- Každý den se ze šablon automaticky generují TimeBlocky pro aktuální den + 6 dní dopředu
- Bloky jsou **odmítnutelné jedním klikem** bez jakéhokoliv trestu — smazání = výjimka
  pouze pro daný den, šablona zůstává aktivní
- Žádný streak counter, žádné "3/7 dní tento týden"

### Vizuální odlišení

Recurring Block se odlišuje od ručně vytvořených bloků:
- **Dashed border** — konzistentní s vizuálním jazykem externích eventů
- **Ikona `Repeat`** (Lucide, 10px) v pravém horním rohu
- Barva pozadí a priority pruh zůstávají stejné — kontext priority čitelný periferním viděním

### Pevná vs. flexibilní šablona

- **Pevná (`is_fixed_time = true`)** — blok se generuje vždy do `preferred_time`
- **Flexibilní (`is_fixed_time = false`)** — systém hledá nejbližší volný slot v okolí
  `preferred_time` (max ±120 min, po 15min krocích); pokud nenajde, generuje jako kolizi

### Vytvoření recurring blocku

Kontextová akce **"Opakovat tento blok"** v detail popovert TimeBlocku:
1. Uživatel vybere frekvenci: `Každý den` / `Prac. dny` / `Vlastní` (výběr dní v týdnu)
2. Zvolí `Pevný čas` nebo `Flexibilní`
3. Potvrdí → šablona se vytvoří, aktuální blok se napojí na šablonu

### Smazání

- Smazání recurring blocku = výjimka pro daný den; šablona zůstává aktivní
- Systém si výjimku pamatuje (smazaný blok s `recurring_template_id` = "přeskočeno dne X")
- Po opakovaném smazání (threshold TBD) systém pasivně nabídne deaktivaci šablony

### Datový model

#### RecurringTemplate (nová tabulka)
| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | PK |
| `title` | NonEmptyString1000 | Název |
| `duration_minutes` | PositiveInt | Délka v minutách |
| `recurrence` | `daily` \| `weekdays` \| `custom` | Frekvence |
| `recurrence_days` | String (nullable) | JSON pole dní 0–6 (0=Po) pro `custom` |
| `preferred_time` | NonEmptyString100 (nullable) | Preferovaný čas "HH:MM" |
| `is_fixed_time` | SqliteBoolean | Pevná vs. flexibilní |
| `energy` | NonEmptyString100 | `normal` \| `lite` \| `draining` |
| `active` | SqliteBoolean | Zda se šablona generuje |
| `source_calendar_id` | CalendarId (nullable) | Pro živý odkaz na ExternalEvent |
| `source_event_uid` | String (nullable) | UID z iCalendar pro živý odkaz |

#### Rozšíření TimeBlock
| Sloupec | Typ | Popis |
|---|---|---|
| `recurring_template_id` | RecurringTemplateId (nullable) | null = ručně vytvořený blok |
| `completed` | SqliteBoolean (nullable) | Rezervováno pro Routines feature |

### Vztah k RRULE

`RecurringTemplate` je vlastní FlowBlock entita, nesouvisí s RRULE v iCalendar standardu.
RRULE expansion pro ExternalEvents a opakující se Tasks jsou samostatné budoucí features.
