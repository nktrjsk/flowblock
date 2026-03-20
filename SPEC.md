# FlowBlock — ADHD-friendly Local-First Plánovač

> **Verze dokumentu:** 0.28.0 (2026-03-20)
> **Status:** Návrh MVP

---

## 1. Vize projektu

Open-source webová aplikace pro plánování času, inspirovaná [Akiflow](https://akiflow.com), navržená s ohledem na ADHD. Základní princip: **unified inbox + time-blocking kalendář** postavený na otevřených standardech (CalDAV) s local-first architekturou.

---

## 2. Klíčové principy

### 2.1 Open-source & open standardy
- Licence: WTFPL nebo jiná copyleft (ne GPL)
- CalDAV (RFC 4791) pro synchronizaci kalendářů
- iCalendar (RFC 5545) — VEVENT pro čtení externích událostí
- Žádný vendor lock-in — uživatel vlastní svá data

### 2.2 Local-first
- Data žijí primárně v lokální SQLite databázi (přes Evolu)
- Aplikace funguje offline
- Synchronizace mezi zařízeními přes Evolu relay server (CRDT, E2E šifrování)
- Read-only integrace s externími kalendáři (CalDAV + veřejné ICS feedy)

### 2.3 ADHD-friendly design
- **Nízké tření:** Zapsání úkolu < 3 sekundy, minimum klikání
- **Žádná rozhodovací paralýza:** Progresivní disclosure, jednoduchý inbox bez složek/štítků v MVP
- **Ochrana před přeplánováním:** Vizuální kapacitní lišta ukazující volný vs. zaplánovaný čas
- **Flexibilita bez trestu:** Nesplněné úkoly se tiše přesouvají, žádné "FAILED" stavy
- **Dopaminové odměny:** Satisfying animace/zvuky při splnění úkolu
- **Ochrana před hyperfokusem:** Jemné připomínky přechodů mezi bloky

---

## 3. Architektura

### 3.1 Přehled

```
┌─────────────────────────────────────┐
│          Web App (React)            │
│                                     │
│  ┌───────────┐    ┌──────────────┐  │
│  │  UI Layer │    │ Command Bar  │  │
│  └─────┬─────┘    └──────┬───────┘  │
│        │                 │          │
│  ┌─────▼─────────────────▼───────┐  │
│  │       Application Logic       │  │
│  │   (task mgmt, time-blocking)  │  │
│  └─────┬─────────────────┬───────┘  │
│        │                 │          │
│  ┌─────▼─────┐    ┌─────▼───────┐  │
│  │   Evolu   │    │ Ext. kal.   │  │
│  │ (lokální  │◄───│ Sync Layer  │  │
│  │  SQLite)  │    │ (read-only) │  │
│  └─────┬─────┘    └─────┬───────┘  │
│        │                 │          │
└────────┼─────────────────┼──────────┘
         │                 │
   Evolu Relay       CalDAV Server
   (multi-device)    (Nextcloud atd.)
```

### 3.2 Source of truth

**Evolu (lokální SQLite) je source of truth.** Sync layer externích kalendářů je read-only bridge:
- Čte z externích CalDAV serverů a veřejných ICS feedů → zapisuje do ExternalEvents v Evolu
- FlowBlock na CalDAV server nic nezapisuje

### 3.3 Mapování externích kalendářů

| Zdroj | Protokol | Co se uloží |
|---|---|---|
| CalDAV server (Nextcloud atd.) | CalDAV (RFC 4791) | VEVENT → ExternalEvents |
| Veřejný ICS feed | HTTP + iCalendar (RFC 5545) | VEVENT → ExternalEvents |

Poznámka: VTODO z CalDAV serverů se ignorují — FlowBlock spravuje úkoly samostatně v Evolu.

---

## 4. Datový model (Evolu schéma)

### 4.1 Tasks

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `title` | NonEmptyString1000 | Název úkolu |
| `description` | String (nullable) | Volitelný popis |
| `status` | `inbox` \| `planned` \| `done` \| `someday` | Stav úkolu (`someday` = "nechám uzrát", viz sekce 14) |
| `priority` | `none` \| `low` \| `medium` \| `high` | Priorita |
| `due_date` | Date (nullable) | Volitelný deadline |
| `energy` | `normal` \| `lite` \| `draining` | Energetická náročnost (default `normal`, viz sekce 11) |
| `waiting_for` | String (nullable) | Na koho/co úkol čeká; null = "ball is in my court" (viz sekce 12) |
| `project_id` | Project ID (nullable) | Reference na projekt (budoucí feature) |
| `created_at` | Timestamp | Čas vytvoření |
| `updated_at` | Timestamp | Čas poslední úpravy |

### 4.2 TimeBlocks

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `task_id` | Task ID (nullable) | Reference na úkol (null pro volné bloky) |
| `title` | NonEmptyString1000 | Název (defaultně z tasku) |
| `start` | Timestamp | Začátek bloku |
| `end` | Timestamp | Konec bloku |

### 4.3 Calendars

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `type` | `caldav` \| `ics` | Typ zdroje |
| `url` | String | CalDAV kolekce URL nebo ICS feed URL |
| `display_name` | String | Název kalendáře |
| `color` | String | Barva pro UI |
| `sync_token` | String (nullable) | Pro inkrementální sync (pouze CalDAV) |
| `last_fetched_at` | Timestamp (nullable) | Čas posledního fetch (ICS polling) |

### 4.4 ExternalEvents

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `calendar_id` | Calendar ID | Reference na kalendář |
| `caldav_uid` | String | UID z CalDAV |
| `caldav_etag` | String | Pro detekci změn |
| `title` | String | Název události |
| `start` | Timestamp | Začátek |
| `end` | Timestamp | Konec |
| `is_all_day` | Boolean | Celodenní událost |

### 4.5 Projects (budoucí feature)

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `name` | NonEmptyString1000 | Název projektu |
| `color` | String | Barva pro UI |
| `description` | String (nullable) | Volitelný popis |
| `weight` | Float | Rotační váha (viz sekce 9) |
| `created_at` | Timestamp | Čas vytvoření |

### 4.6 Notes

Rychlé záznamy z inboxu. Výchozí chování quick-add inputu — text bez prefixu se uloží jako poznámka. Prefix `//` přepne input do režimu task. Jsou samostatnou entitou oddělenou od Tasks — nemají prioritu, status ani energii. Slouží jako dočasné záchytné místo pro myšlenky, které zatím nejsou úkolem.

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `content` | NonEmptyString1000 | Text poznámky |
| `status` | `new` \| `reviewed` | Stav (`new` = nová, `reviewed` = zpracovaná) |
| `converted_task_id` | Task ID (nullable) | Reference na úkol, pokud byla poznámka převedena |

---

## 5. UI Layout

### 5.0 Chování při startu

Aplikace se při otevření zobrazí okamžitě — bez loading screenu, splash screenu ani skeleton stavu.
`useQuerySubscription` (Evolu) nikdy nesuspenduje React render; UI je dostupné ihned, data se
dosýpají do komponent reaktivně. Prázdné stavy (prázdný inbox, žádné bloky) jsou validní počáteční
stavy, ne chybové stavy.

### 5.1 Dva režimy zobrazení

Appka má dva hlavní pohledy, přepínatelné tlačítky v hlavní liště:

**Dashboard (výchozí)** — zaměřený na "co teď", vertikální stack informačních bloků s kalendářovými sloupci pro plánování po straně.

**Týdenní pohled** — plný týdenní kalendář pro hromadné plánování a přehled celého týdne.

### 5.2 Dashboard (výchozí pohled)

```
┌──────────────────────────────────────────────────────────┐
│  [Dnes]  [Týden]                           [⚙]  [Sync]  │
├──────────────────────────────────┬───────────────────────┤
│                                  │ DNES (Po) │ ZÍT (Út) │
│  ┌──────────────────────────┐    │ ┌───────┐ │ ┌──────┐ │
│  │  TEĎ: Kódování           │    │ │██ Kód │ │ │── Sch│ │
│  │  ██████████░░░  zbývá 45m │    │ │       │ │ │      │ │
│  └──────────────────────────┘    │ │── Sch.│ │ │██ Re │ │
│                                  │ │       │ │ │      │ │
│  INBOX (3)                       │ │██ Mail│ │ │      │ │
│  ☐ Zavolat na pojišťovnu   ⚡   │ │       │ │ │      │ │
│  ☐ Napsat report                │ └───────┘ │ └──────┘ │
│  ☐ Koupit mléko            ☁   │           │          │
│  + Přidat úkol                  │           │          │
│                                  │           │          │
│  NADCHÁZEJÍCÍ                    │           │          │
│  14:00 Schůzka s Petrem         │           │          │
│  16:00 Review PR                │           │          │
│                                  │           │          │
│  PROJEKTY                        │           │          │
│  ● FlowBlock (3 úkoly)         │           │          │
│  ● Diplomka (1 úkol)  ↑        │           │          │
│                                  │           │          │
│  ── Done ──                      │           │          │
├──────────────────────────────────┴───────────────────────┤
│  ░░░░░░░░░▓▓▓▓▓░░░░  Dnes: 3h volných                   │
└──────────────────────────────────────────────────────────┘
```

Dashboard je **vertikální stack** s fixní hierarchií (shora dolů = od nejdůležitějšího):

1. **"Co teď"** — aktuální nebo příští time-block s progress barem a zbývajícím časem. Pokud nic neběží: "Žádný blok — volný čas" (nebo smart suggestion, viz sekce 13).
2. **Inbox** — nezaplánované úkoly. Úkoly s `waiting_for` ztlumené, draining úkoly s ⚡ indikátorem, lite úkoly s ☁. Drag & drop do kalendářových sloupců vpravo.
3. **Nadcházející** — zbytek dnešního plánu jako jednoduchý timeline (ne kalendářový grid).
4. **Projekty** — sbalitelné skupiny s rotační váhou; ↑ indikátor u projektů, které vyplouvají (viz sekce 9).
5. **Done** — sbalená sekce dokončených úkolů.

**Reaktivita dashboardu:** Sekce "Co teď" a "Nadcházející" se automaticky aktualizují každou minutu na základě aktuálního času — bez nutnosti refreshe stránky. Stejný 1minutový interval platí pro indikátor aktuálního času v kalendáři (viz 5.6).

**Kalendářové sloupce (vpravo):** Dva úzké sloupce — dnešek a zítra. Slouží primárně jako **drop target** pro plánování. Plně interaktivní (drag, resize, vše). Navigace šipkami posouvá o den. Budoucí option: přepínání kalendářových sloupců vlevo/vpravo.

### 5.3 Týdenní pohled (sekundární)

```
┌─────────────────────────────────────────────────┐
│  [Dnes]  [◄ Týden ►]              [⚙]  [Sync]  │
├────────────┬────────────────────────────────────┤
│            │  Po    Út    St    Čt    Pá        │
│  INBOX     │  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐    │
│            │  │  │  │  │  │  │  │  │  │  │    │
│ ☐ Task 1  │  │  │  │██│  │  │  │  │  │  │    │
│ ☐ Task 2  │  │  │  │██│  │  │  │  │  │  │    │
│ ☐ Task 3  │  │──│  │  │  │██│  │  │  │  │    │
│ ☐ Task 4  │  │  │  │  │  │  │  │──│  │  │    │
│            │  │  │  │  │  │  │  │──│  │  │    │
│ + Add task │  │  │  │  │  │  │  │  │  │  │    │
│            │  └──┘  └──┘  └──┘  └──┘  └──┘    │
│ ── Done ── │                                    │
│ ✓ Task 0   │  ██ = tvůj time-block              │
│            │  ── = externí událost (CalDAV)     │
├────────────┴────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░▓▓▓▓░░░  Dnes: 3h volných     │
└─────────────────────────────────────────────────┘
```

Plný týdenní kalendář s inboxem vlevo. Určen pro hromadné plánování a přehled celého týdne.

### 5.4 Estetika

Styl **warm paper-industrial** — inspirovaný fyzickým diářem přeneseným do digitálu:

- Pozadí: krémová `#f5f0e8`
- Akcenty: tmavá břidlice `#1a1a2e`
- Typografie: Sora (UI) + Instrument Serif italic (brand)
- Time-blocky: zbarveny dle priority (viz 5.5)
- Externí CalDAV události: přerušovaný border, italic, vizuálně odlišené

**Dark mode paleta:**
- Pozadí: `#1a1a2e` (tmavá břidlice — stávající brand barva)
- Povrch (karty, panely): `#252540`
- Text primární: `#f5f0e8` (krémová — stávající brand barva)
- Akcenty: priority barvy mají samostatné dark mode varianty (viz sekce 5.5)
- Vodící linky gridu: hodinové `#3a3c58`, půlhodinové `#2e3050`, čtvrthodinové `#252740`

### 5.5 Barvy time-bloků dle priority

#### Light mode

| Priorita | Pozadí | Border | Text |
|---|---|---|---|
| `high` | `#fee2e2` | `#f87171` | `#991b1b` |
| `medium` | `#fef3c7` | `#f59e0b` | `#92400e` |
| `low` | `#dbeafe` | `#60a5fa` | `#1e3a8a` |
| `none` | `#f1f5f9` | `#94a3b8` | `#334155` |
| external | `#f5f0e8` | `#1a1a2e55` dashed | `#1a1a2e66` |

#### Dark mode

| Priorita | Pozadí | Border | Text |
|---|---|---|---|
| `high` | `#4a2222` | `#f87171` | `#fca5a5` |
| `medium` | `#493614` | `#f59e0b` | `#fcd34d` |
| `low` | `#1e2d4a` | `#60a5fa` | `#93c5fd` |
| `none` | `#2a2c45` | `#475569` | `#94a3b8` |
| external | `#252540` | `#f5f0e855` dashed | `#f5f0e866` |

#### Vizuální rozlišení — prázdný vs. linked blok

| Typ bloku | Border | Pozadí | Titulek | Ikona |
|---|---|---|---|---|
| Prázdný (bez `task_id`) | dashed | průhledné (nižší opacita) | muted barva | — |
| Linked (s `task_id`) | solid | plné (vyšší opacita) | normální barva | `ListTodo` (Lucide, 10px) |

Vizuální rozlišení umožňuje uživateli periferním viděním okamžitě rozpoznat, které bloky mají přiřazený úkol a které jsou "volné" rezervace.

### 5.6 Interakce

- **Vytvoření TimeBlocku double-click + drag** — double-click na prázdné místo v kalendáři
  spustí drag mode pro definici délky bloku. Táhnutím dolů uživatel určí délku bloku (snap 15 min).
  Po puštění se blok vytvoří a okamžitě se otevře detail popover pro editaci.
  Pokud uživatel pustí bez tažení, vytvoří se 60minutový blok.
- **Drag tasku z inboxu** do kalendářového sloupce → vytvoří TimeBlock + změní status úkolu na `planned`.
  Nad **prázdným místem** v kalendáři se zobrazí ghost (poloprůhledný dashed obrys) jako náhled nového bloku.
  Nativní drag image browseru je potlačen. Místo něj se zobrazuje **custom ghost div** sledující kurzor,
  vycentrovaný na pozici kurzoru — pro přirozený pocit "uchopení" položky.
- **Přiřazení tasku přetažením na existující blok** — přetažení tasku z inboxu na existující
  TimeBlock (místo na prázdné místo v kalendáři) přiřadí task k bloku. Task se označí jako
  `planned`. Při hoveru nad existujícím blokem ghost zmizí a blok se zvýrazní (`ring-2 ring-ink/40`) —
  vizuální signál, že drop přiřadí task (ne vytvoří nový blok).
- **Drag time-blocku v kalendáři** → přesun na jiný slot/den; drag funguje z celé plochy bloku.
  Při dragu se blok centruje pod kurzor (offset = polovina délky bloku).
  - Při dragu se zobrazí **ghost** (poloprůhledný dashed obrys) ukazující cílový slot
  - Ghost zobrazuje: **prioritní pruh vlevo** (barva dle priority bloku/tasku), **čas** (`HH:MM – HH:MM`) a **titul** bloku nebo přiřazeného tasku
  - Nativní drag image browseru je potlačen (1px průhledný canvas)
  - Vedle ghosta se zobrazí **tooltip s přesným časem** (`HH:MM – HH:MM`); tooltip se přepne na druhou stranu, pokud je blok ve dvou pravých sloupcích
  - Drop funguje i když je cílový čas překrytý jiným blokem (overlay mechanismus)
- **Drag time-blocku zpět do inboxu** → odstraní TimeBlock, vrátí úkol do stavu `inbox`; inbox se vizuálně zvýrazní (zelené pozadí + hint text) při přetahování bloku
- **Resize time-blocku** → kruhové handles (bílé kolečko, 22px, ikona `GripVertical` z Lucide) na horním a dolním okraji bloku, zobrazí se při hoveru; přichytávání na 15 min; resize a drag jsou vzájemně exkluzivní (resize neaktivuje drag)
  - Při aktivním resize (tažení dolní hrany) se kapacitní lišta daného dne (`DayCapacityBars`) aktualizuje **lokálně v reálném čase** — reaguje na průběžnou délku bloku ještě před puštěním myši
  - Finální uložení do Evolu proběhne až po `mouseUp` (stávající chování zachováno); lokální live update je čistě vizuální, bez mezizápisů do DB
  - Stejné chování platí pro drag (přesun bloku mezi sloty) — kapacitní lišta obou dotčených dnů se aktualizuje lokálně po dobu dragu
- **Kolizní layout (překrývající se bloky)** — pokud se dva nebo více time-bloků v jednom dni překrývají,
  zobrazí se vedle sebe místo přes sebe. Šířka každého bloku se vypočítá dynamicky (greedy sweepline algoritmus).
  - Při dragu přesouvaného bloku se ostatní bloky ve stejné kolizní skupině okamžitě rozšíří zpět na plnou šířku
    (jako by přesouvaný blok nebyl přítomen — two-layout přístup).
  - Ghost při dragu má šířku odpovídající koliznímu layoutu cílové pozice.
- **Indikátor aktuálního času** → červená horizontální linka s kruhovým špendlíkem na levém okraji, zobrazuje se pouze ve sloupci aktuálního dne; aktualizuje se každou minutu
- **Scroll při načtení** → kalendář se automaticky odscrolluje tak, aby byl indikátor aktuálního času viditelný (vertikálně vycentrovaný)
- **Drop target grid:** 15minutový snap; čtvrthodinové linie vyznačeny tečkovaně v pozadí
- **Checkbox** → přesun do Done se satisfying toastem
- **+ Přidat úkol** → inline input přímo v inboxu; Enter uloží, Escape zruší
- **Vodící linky kalendářového gridu:** Hodinové linky výrazné (solid,
  dobře viditelné). Půlhodinové linky jemné (světlejší, tenčí). Čtvrthodinové
  linky nejjemnější nebo zcela bez linky — slouží jen jako snap target,
  nejsou vizuálně rušivé.
  - Light mode: hodinové `#d1d5db`, půlhodinové `#e5e7eb`, čtvrthodinové `#f3f4f6`
  - Dark mode: hodinové `#3a3c58`, půlhodinové `#2e3050`, čtvrthodinové `#252740`
- **Transition buffer zóny** — pokud je v Nastavení → Plánování nastavena přestávka mezi bloky (viz sekce 5.9):
  - Za každým time-blokem se vykreslí šrafovaná zóna odpovídající délky (5 / 10 / 15 min)
  - Vizuální styl: diagonální šrafy (`repeating-linear-gradient`, úhel −45°), velmi nízká opacita — rušivost na minimum
  - `pointer-events: none` — zóna není klikatelná, neblokuje drop
  - Při drag & drop a resize se blok automaticky posune za buffer zónu, pokud by do ní zasahoval (clamping na hranici zóny)
  - Buffer zóna je čistě vizuální + UX pomůcka; neukládá se do DB, neovlivňuje uložené časy time-bloků
  - **Stav implementace:** Feature byla dočasně odstraněna z důvodu chyb; bude reimplementována od základů.

### 5.7 Kapacitní lišty (per-day)

Každý den v týdenním pohledu i dashboard sloupcích má vlastní dvojici lišt
umístěnou v hlavičce sloupce (nad kalendářovým gridem):

- **Časová lišta** — ikona `Clock` (Lucide), barva zelená → amber → červená
  podle poměru zaplánovaných hodin k denní kapacitě (default 8h).
  Tooltip při hoveru: `4h / 8h`.
- **Energetická lišta** — ikona `Zap` (Lucide), fialová škála
  (světlá → sytá → tmavá). Tenčí než časová lišta — energie je sekundární
  informace. Tooltip při hoveru: slovní popis (`Energie: nízká / střední / vysoká`).
- Lišty jsou vždy viditelné, nekollapsují.
- Energetická lišta je zatím placeholder (zobrazuje mock data), plná funkčnost
  závisí na implementaci energy feature (sekce 11).
- **Responzivita při drag & resize operacích:** Lišty reagují lokálně v reálném čase během resize i dragu time-bloků — bez čekání na uložení do Evolu. Viz sekce 5.6 (Resize time-blocku).

### 5.8 Mobilní UI

Mobilní verze je samostatný layout optimalizovaný pro "capture + check" use-case.
Plánování (drag & drop, resize) zůstává na desktopu.

**Struktura: dva taby ve spodní liště**

- **Inbox** — výchozí tab. Seznam nezaplánovaných úkolů s prioritními a
  energetickými pilly. Sbalitelná sekce Hotovo. FAB tlačítko (+) vpravo dole
  pro rychlé přidání úkolu.
- **Dnes** — denní timeline. "Právě teď" karta nahoře s názvem aktuálního
  bloku, progress barem a zbývajícím časem. Pod ní chronologický seznam
  dnešních bloků (vlastní = amber tečka, aktuální = červená tečka s glowem,
  externí CalDAV = šedá tečka + dashed karta). FAB tlačítko (+) vpravo dole
  pro rychlé přidání úkolu.

**Kapacitní lišty** — zobrazeny pod topbarem, nad obsahem tabu (stejná
podoba jako sekce 5.7, ale pro aktuální den).

**Quick-add sheet** — FAB otevře bottom sheet s jednořádkovým inputem.
Enter nebo tlačítko "Přidat" uloží úkol do inboxu. Tap mimo sheet zavře
bez uložení.

**Co mobilní verze neobsahuje:** týdenní pohled, drag & drop plánování,
resize time-bloků, dashboard s projekty.

> **TBD:** Detailní specifikace mobilního inboxu (komponenty, pořadí položek, touch interakce) bude doplněna samostatně.

### 5.9 Nastavení

**Desktop:** ikona `Settings` (Lucide) v pravém horním rohu hlavní lišty.
Klik otevře modal.

**Mobil:** stejná ikona `Settings` v pravém horním rohu topbaru.
Klik otevře modal. Konzistentní s desktopem.

Nastavení se otevírá výjimečně — není součástí každodenního flow,
proto nezabírá místo v bottom tab baru.

#### **Obsah modalu**

*Identita (Evolu)*
- **Sync toggle** — přepínač "Povolit synchronizaci" (výchozí: **vypnuto**). Ovládá, zda se aplikace
  připojuje k Evolu relay serveru. Slouží jako hlavní on/off pro synchronizaci mezi zařízeními.
  - Vypnutý sync = aplikace funguje čistě lokálně, bez síťových připojení k relay
  - Přepínač je umístěn v hlavní sekci Nastavení (ne v Pokročilé) — jde o běžné uživatelské rozhodnutí
- Zobrazení aktuálního Owner ID (zkrácený hash)
- Export owner key (tlačítko → stáhne soubor nebo zobrazí key k zkopírování)
- Import owner key (tlačítko → file picker nebo paste input)
- Varování při importu: "Importování jiného klíče přepíše lokální identitu"
*Pokročilé*
- **Vlastní Evolu relay URL** — textové pole, výchozí hodnota: `wss://free.evoluhq.com`
  - Validace formátu: URL musí začínat `wss://` nebo `ws://`; jinak se zobrazí chybová hláška pod polem
  - Badge vedle labelu zobrazuje stav připojení v reálném čase:
    - "Kontroluji…" (spinner) — probíhá WebSocket probe
    - "Dostupné" (zelená tečka) — server odpovídá
    - "Nedostupné" (červená tečka) — server nedostupný
  - Ověření se spouští s 500ms debouncem po každé změně v poli
  - Prázdné pole = výchozí relay `free.evoluhq.com`
  - Tlačítko "Uložit" — uloží URL do localStorage, aplikace se po 800ms restartuje
  - Varování: "Změna relay URL odpojí synchronizaci s předchozím serverem."

#### highlightSync — zvýrazněné otevření

SettingsModal podporuje prop `highlightSync?: boolean`. Pokud je nastaven na `true`
(typicky voláno z WelcomeCard přes odkaz "zapnout synchronizaci"):
- Modal se otevře
- Automaticky se odscrolluje na sekci *Identita (Evolu)* (kde se nachází sync toggle)
- Sekce *Identita (Evolu)* se na 2 sekundy vizuálně zvýrazní (ring efekt)

Efekt slouží jako kontextový ukazatel pro uživatele, který přichází z WelcomeCard
a neví, kde sync nastavení hledat.

*Kalendáře*
- Seznam přidaných kalendářů (název, typ, barva, čas posledního syncu)
- Na každém řádku kalendáře (hover akce):
  - Per-kalendář sync tlačítko (ikona `RefreshCw`, Lucide) — spustí sync jen pro daný kalendář; při syncu se ikona roztočí (spinning stav)
  - Tlačítko pro editaci kalendáře (ikona `Pencil`, Lucide) — rozbalí inline editační formulář pod řádkem (accordion vzor)
  - Tlačítko pro smazání kalendáře
  - Persistent chybový text pod řádkem, pokud sync tohoto kalendáře selhal — zobrazuje se do dalšího úspěšného syncu
- **Inline editační formulář** (accordion pod řádkem):
  - Editovatelná pole: `display_name`, `url`, `username`, `password`, `color`
  - Pole `type` (`caldav` / `ics`) není editovatelné — změna typu znamená jiný sync mechanismus; doporučené řešení je smazat a přidat znovu
  - Vizuální styl formuláře je shodný se stávajícím formulářem "Přidat kalendář"
  - Heslo je při otevření formuláře skryté (`type="password"`); tlačítko vedle pole toggluje viditelnost
  - Barva: sada přednastavených barev jako klikatelná kolečka (stejný vzor jako "Přidat kalendář")
  - V jednom okamžiku může být otevřen max. jeden formulář (editace nebo přidání) — druhý se automaticky zavře
  - Ikona `Pencil` se při otevření editace změní na `X` (indikuje možnost zavřít)
  - Tlačítko **"Uložit a synchronizovat"** — uloží změny do Evolu, okamžitě spustí re-sync tohoto kalendáře, zobrazí toast
  - Tlačítko **"Zrušit"** — zavře formulář bez uložení, bez potvrzovacího dialogu
- Tlačítko "Přidat kalendář" (ICS feed nebo CalDAV)

*Vzhled*
- Přepínač světlý / tmavý režim (toggle, default = světlý)
- Systémový režim ("Řídit se systémem") jako třetí volba
- Nastavení se uloží do localStorage (nezávisle na Evolu — jde o preferenci zařízení, ne data)
- Formát času: přepínač `24h` / `12h (AM/PM)` (default = 24h)
  - Projeví se všude kde se zobrazuje čas: time-blocky v kalendáři, time pickery v detail popovert, "Co teď" / "Nadcházející" v dashboardu, tooltip při dragu (HH:MM – HH:MM)
  - Uložení do localStorage (preference zařízení)

Sekce denní kapacita bude doplněna postupně.

*Plánování*
- **Přestávka mezi bloky** — segment control se čtyřmi možnostmi: `Vypnuto` / `5 min` / `10 min` / `15 min` (default = Vypnuto)
  - Ukládá se do localStorage (`flowblock_transition_buffer`)
  - Po každém time-bloku v kalendáři se zobrazí šrafovaná zóna odpovídající délky; zóna vizuálně signalizuje, že slot je vyhrazen na přechod
  - Při drag & drop i resize se blok automaticky posune tak, aby nepřetékal do buffer zóny jiného bloku
  - Viz sekce 5.6 (interakce) pro detailní chování buffer zón v kalendáři
  - **Stav implementace:** Feature byla dočasně odstraněna; bude reimplementována od základů.
- **Zkratkové hinty** — toggle (default = zapnuto)
  - Pokud zapnuto: u tlačítek v popovert se zobrazují malé klávesové zkratky (např. `Del` u tlačítka Smazat, `Ctrl+↵` u tlačítka Hotovo)
  - Ukládá se do localStorage (`flowblock_shortcut_hints`)

### 5.10 Sync tlačítko v Headeru

Mezi navigačními tlačítky (Dnes / Týden) a ikonou Nastavení je umístěno **Sync tlačítko** (`ml-auto` zcela vpravo, vlevo od ikony Nastavení):

- **Ikona:** `RefreshCw` (Lucide), bez popisku
- **Klik:** spustí manuální sync všech kalendářů (`syncNow()`)
- **Spinning stav:** ikona se roztočí, dokud sync probíhá (`syncing === true`)
- **Chybová indikace:** pokud existují neuznané chyby z posledního syncu (polling nebo manuální), zobrazí se malá oranžová tečka absolutně pozicovaná v pravém horním rohu ikony. Tečka zmizí po dalším úspěšném syncu.
- Tlačítko je vždy viditelné (desktop i mobil), i pokud nejsou přidány žádné kalendáře — v takovém případě klik nic neudělá (nebo tlačítko je disabled).

### 5.11 Sync feedback — toast notifikace

#### Princip stratifikace

Ne každá sync událost je stejně důležitá. Feedback se liší podle toho, zda akci spustil uživatel explicitně, nebo se děje na pozadí:

| Událost | Forma feedbacku | Délka |
|---|---|---|
| Kalendář úspěšně přidán | Toast zelený: "Kalendář přidán" | 2,5 s |
| Počáteční sync po přidání selhal | Toast červený: "Sync selhal: [důvod]" | 6 s |
| Kalendář upraven a synchronizován (úspěch) | Toast zelený: "Kalendář uložen" | 2,5 s |
| Sync po úpravě selhal | Toast červený: "Sync selhal: [důvod]" | 6 s |
| Manuální sync dokončen (úspěch) | Toast zelený: "Synchronizováno" | 2 s |
| Manuální sync dokončen (chyba) | Toast červený: "Sync selhal: [důvod]" | 6 s |
| Polling (pozadí) selhal | Oranžová tečka na Sync tlačítku + persistent text v SettingsModal | Dokud trvá chyba |
| Polling (pozadí) úspěšný | Žádný feedback | — |

Polling na pozadí záměrně **nevyvolává toast** — automatický sync každých 30 minut by jinak generoval notifikace bez akce uživatele, což je pro ADHD mozek zbytečný šum.

#### Texty toastů

- Kalendář přidán: "Kalendář přidán"
- Kalendář upraven: "Kalendář uložen"
- Sync úspěšný (manuální): "Synchronizováno"
- Sync selhal (konkrétní důvod): "Sync selhal: [chybová zpráva, max. 60 znaků]"
- Sync selhal (generický fallback): "Sync selhal — zkontroluj URL nebo přihlašovací údaje"

#### Rozšíření Toast systému

Stávající `Toast.tsx` podporuje pouze success styl (zelený). Potřebné rozšíření:

```
show(message: string, options?: { type?: "success" | "error", duration?: number })
```

- `success` (default): zelené pozadí/border/text, 2200 ms
- `error`: červené pozadí/border/text, 6000 ms, s tlačítkem pro ruční zavření

#### Chybový stav v SettingsModal

Na řádku každého kalendáře v sekci Kalendáře (viz 5.9):
- Pokud sync tohoto kalendáře selhal, zobrazí se pod řádkem malý červený text s popisem chyby
- Text je persistent — zůstává viditelný, dokud sync daného kalendáře úspěšně neproběhne
- Chybový stav pochází z `errors: Record<calendarId, string>` vráceného `useCalendarSync` hookem

### 5.12 Priority UI

#### Zobrazení priority v inboxu

Každý task item zobrazuje prioritu jako **barevný vertikální pruh** (2–3 px) na levém okraji řádku. Barvy odpovídají tabulce v sekci 5.5:

| Priorita | Barva pruhu |
|---|---|
| `high` | `#f87171` (červená) |
| `medium` | `#f59e0b` (žlutá) |
| `low` | `#60a5fa` (modrá) |
| `none` | `#94a3b8` (šedá, výrazně ztlumená — vizuálně nenápadná) |

Barevný pruh je pasivní signál čitelný periferním viděním — nevyžaduje kognitivní zpracování a nezabírá prostor v řádku.

#### Nastavení priority — inline popover

Na task itemu v inboxu se při hoveru zobrazí drobné tlačítko priority (ikona `Flag`, Lucide, 14px, ztlumená barva). Kliknutí otevře **miniaturní popover** se čtyřmi možnostmi:

```
( )  Žádná  (šedá)
(!)  Nízká  (modrá)
(!!) Střední (žlutá)
(!!!) Vysoká (červená)
```

- Popover se zavře okamžitě po výběru nebo kliknutím mimo
- Žádný potvrzovací dialog — výběr se uloží ihned
- Výchozí hodnota je `none` — uživatel není nucen prioritu nastavovat

#### Priority v time-blocích

Time-blocky jsou zbarveny dle priority celým pozadím bloku (viz sekce 5.5). Žádný dodatečný vizuální element není potřeba — barva bloku je primárním nositelem informace o prioritě.

#### Priority na mobilní verzi

Na mobilní verzi (sekce 5.8) je priorita v timeline zobrazena stejným barevným pruhem na levém okraji karty bloku. Nastavení priority je dostupné přes detail úkolu (long-press nebo tap na kartu).

### 5.13 Detail time-bloku — popover

#### Spoustec

Kliknuti na plochu time-bloku (ne na drag handle ani resize handle) otevire detail popover.

#### Forma

**Popover** se otevírá u pozice kurzoru v momentě kliknutí na blok. Není to fullscreen overlay ani slide-in panel — popover zachovává kontext kalendáře viditelný v pozadí. Zavře se kliknutím mimo nebo klávesou Escape.

**Pozicování:** horizontálně centrovaný na X souřadnici kurzoru; vertikálně zarovnaný k Y souřadnici kurzoru s offsetem −16 px (mírně nad místem kliknutí). Clamped k okrajům viewportu — minimálně 8 px od každého okraje.

Na mobilni verzi se detail zobrazuje jako **bottom sheet** (ne popover).

#### Obsah a editovatelna pole

```
[ Nazev bloku                    ]  <- inline input, autofokus
  Zacatek: [ 14:00 ]  Konec: [ 15:00 ]  <- time pickery, snap 15 min
  Priorita: ( )zadna  (!)nizka  (!!)stredni  (!!!)vysoka
  Propojeny ukol: "Nazev ukolu"  [ x odpojit ]

  [ Smazat blok ]               [ Hotovo ]
```

Tlačítko "Smazat blok" nespustí smazání okamžitě — zobrazí **inline confirm dialog** přímo na místě action baru:

```
  Smazat blok?      [ Zrušit ]  [ Smazat ]
```

- Focus se automaticky přesune na tlačítko "Zrušit" při otevření confirm dialogu
- Tab uvnitř confirm dialogu cyklí pouze mezi "Zrušit" a "Smazat" (Tab loop)
- Escape v confirm dialogu zavře confirm dialog (ne celý popover)
- Klávesa `Delete` (mimo text inputy) otevře confirm dialog; po otevření Escape confirm dialog zavře

Editovatelne parametry:
- `title` — inline textovy input
- `start` a `end` — time pickery (segmentovaný vstup HH:MM), viz sekce 5.13.1
- `priority` — stejny inline vzor jako v sekci 5.12
- Propojeny ukol — zobrazeni nazvu (`task_id` reference); tlacitko pro odpojeni bloku od ukolu

#### Chovani pri editaci propojeného ukolu

TimeBlock si uchovává vlastní `title` a `priority` nezávisle na přiřazeném tasku. Při zobrazení mají taskové hodnoty přednost — title a priority přiřazeného tasku vizuálně "překryjí" vlastní hodnoty bloku, ale data bloku zůstávají v DB nedotčena. Po odpojení tasku se blok automaticky vrátí na svá původní nastavení bez nutnosti jakékoliv další akce ze strany uživatele.

| Akce | Dopad na blok | Dopad na úkol |
|---|---|---|
| Přiřazení tasku k bloku | `task_id` se uloží; vlastní `title` a `priority` bloku se nepřepisují | Task se označí jako `planned` |
| Zobrazení linked bloku | Zobrazuje se `task.title` a `task.priority` (mají přednost před hodnotami bloku) | — |
| Změna `title` bloku | Uloží se do vlastního `title` bloku; po odpojení tasku se opět zobrazí | Žádný dopad |
| Změna `priority` bloku | Uloží se do vlastní `priority` bloku; po odpojení tasku se opět projeví | Žádný dopad |
| Odpojení tasku (tlačítko "Odpojit") | Blok se vrátí na vlastní `title` a `priority`; `task_id` = null | Task se vrátí do stavu `inbox` |
| Smazání bloku | Blok se odstraní | Task se vrátí do stavu `inbox` |

Blok vytvořený přetažením tasku z inboxu na prázdné místo v kalendáři si jako vlastní `title` zachová název tasku v okamžiku vzniku — tento title zůstane i po případném odpojení tasku.

Přepojení bloku na jiný úkol je možné přes task search dropdown v popovert nebo přetažením tasku z inboxu na existující blok v kalendáři.

#### Přiřazení úkolu z popovert — task search input

Sekce "Propojený úkol" v detail popovert podporuje dva stavy:

**Žádný úkol není přiřazen:**
Zobrazí se inline search input s ikonou `Link2` (Lucide) nalevo. Dropdown
se otevírá při focusu inputu (ne kliknutím na tlačítko) a zavírá se okamžitě
při ztrátě focusu — bez prodlevy.
- Šipky nahoru/dolů pohybují kurzorem v dropdownu
- Enter vybere zvýrazněný task a přiřadí ho k bloku; task se označí jako `planned`
- Escape zavře dropdown bez změny

Tab flow v popovert zahrnuje search input: Priorita → Search input → Hotovo
(Shift+Tab funguje v opačném směru).

**Úkol je přiřazen:**
Zobrazí se název přiřazeného tasku se dvěma akcemi:
- Tlačítko "Změnit" — zobrazí search input pro přiřazení jiného tasku
- Tlačítko "Odpojit" — odstraní vazbu; task se vrátí do stavu `inbox`

### 5.13.1 Time input — segmentovaný vstup

Time inputy pro `start` a `end` v detail popovert používají **segmentovaný formát**
(ne volný text input). Komponenta zobrazuje segmenty oddělené statickým oddělovačem.

Time blocky nejsou omezeny na jediný den — blok může začínat jeden den a končit
druhý (overnight nebo vícedenní blok).

**24h formát:**

```
[ 14 ] : [ 00 ]
  HH       MM
```

**12h formát (AM/PM):**

```
[ 2 ] : [ 00 ]  [ AM ]
 HH      MM     perioda
```

#### Interakce segmentů

- **Focus:** kliknutí na libovolný segment ho aktivuje (vizuální highlight; segment
  se chová jako spinner, ne jako text field — systémový kurzor skrytý)
- **Šipka nahoru / dolů:**
  - Segment HH: změní hodinu o ±1 (rozsah 0–23 v 24h; 1–12 v 12h); zastaví se
    na hranici, nepřetéká
  - Segment MM: změní minuty o ±5 (rozsah 0–59); zastaví se na hranici,
    nepřetéká do hodin
  - Segment AM/PM (pouze 12h): přepíná mezi AM a PM
- **Šipka vpravo:** posune focus na další segment (HH → MM → AM/PM); z
  posledního segmentu pole "Začátek" přejde na první segment pole "Konec";
  z posledního segmentu pole "Konec" přejde na datum adjuster (viz sekce 5.13.2)
- **Šipka vlevo:** posune focus na předchozí segment (AM/PM → MM → HH); z
  prvního segmentu pole "Konec" přejde na poslední segment pole "Začátek"
- **Tab:** přepíná mezi celými poli v pořadí title → Začátek → Konec →
  Priorita → Hotovo (Tab skočí vždy na první segment daného pole)
- **Přímý vstup číslic:** přepíše hodnotu segmentu; po vyplnění dvou číslic se
  focus automaticky přesune na další segment; libovolná hodnota je platná
  (žádný snap, žádné omezení na konkrétní minuty)
- **Prázdný segment při ztrátě focusu:** tiché vrácení na předchozí platnou
  hodnotu — žádná chybová hláška, žádná ztráta editace
- **Zero-padding:** segment HH i MM se vždy zobrazí jako dvouciferné číslo
  (např. "8" → "08" po opuštění segmentu)

#### Overnight a vícedenní bloky — datum indikátor

Pokud je end HH:MM < start HH:MM (nebo end HH:MM = start HH:MM), systém
předpokládá, že blok přechází přes půlnoc. Vedle pole "Konec" se zobrazí
malý badge **"+1 den"** (nebo konkrétní datum konce, např. "út 18. 3.").

Pro posun data konce slouží **datum adjuster** — viz sekce 5.13.2.

Speciální případ: hodnota **24:00** v poli "Konec" je povolena (výhradně
jako HH=24, MM=00) a interpretuje se jako 00:00 následujícího dne — tedy
overnight blok končící přesně na půlnoci. Interně se uloží jako 00:00
+1 den.

#### Validace

**Hranice segmentů (tiché clamping):**
- Segment HH: rozsah 0–23 (výjimka: hodnota 24 povolena pouze v poli
  "Konec" a pouze s MM=00, viz výše); hodnota mimo rozsah se tiše ořízne
  bez hlášky
- Segment MM: rozsah 0–59; hodnota mimo rozsah se tiše ořízne bez hlášky
- Clamping proběhne při ztrátě focusu ze segmentu nebo při submitu

**Logická validace (vizuální, neblokující):**
- **Podmínka:** `end_datetime > start_datetime` — porovnání probíhá na
  absolutních timestamp hodnotách (datum + čas), ne jen na HH:MM; overnight
  a vícedenní bloky jsou tedy automaticky platné pokud end datum > start datum
- **Při porušení:** pole "Konec" dostane červený border a červený podtext
  "Konec musí být po začátku"; tlačítko "Hotovo" je disabled
- Uživatel zůstává v popovert a může editaci dokončit

**Co se záměrně nevaliduje:**
- Minimální délka bloku — žádné omezení; blok může být libovolně krátký
  pokud `end_datetime > start_datetime`

*Poznámka: 15minutový snap (SNAP_MINUTES) se aplikuje výhradně při drag &
resize operacích v kalendáři — v detail popovert není aktivní.*

### 5.13.2 Klávesnicová navigace v detail popovert

#### Tab flow

Pořadí Tab focusu v popovert:

```
title → Začátek → Konec → Priorita → Search input (pokud není úkol přiřazen) → Hotovo
```

Akční prvky mimo Tab flow (tabIndex=-1): tlačítko X (zavřít), tlačítko Smazat,
tlačítka ±1d (datum adjuster), tlačítko Odpojit úkol. Tyto prvky jsou dostupné
myší nebo šipkami, ale Tab je přeskakuje — minimalizuje počet stisků pro
standardní workflow.

Tab na pole "Začátek" nebo "Konec" přesune focus na první segment (HH) daného pole.

#### Navigace šipkami v TimeSegmentInput

Uvnitř každého pole (Začátek / Konec) fungují šipky takto:

| Klávesa | Chování |
|---|---|
| Šipka vpravo | HH → MM → (AM/PM v 12h formátu) → přechod do dalšího pole nebo adjusteru |
| Šipka vlevo | Opačný směr; z prvního segmentu Konec → poslední segment Začátek |

Přechody mezi poli:
- Šipka vpravo z posledního segmentu **Začátek** → první segment **Konec**
- Šipka vpravo z posledního segmentu **Konec** (MM nebo AM/PM) → **datum adjuster**
- Šipka vlevo z prvního segmentu **Konec** → poslední segment **Začátek**
- Šipka vlevo na adjusteru s hodnotou 0d → poslední segment **Konec**

#### Datum adjuster

Adjuster zobrazuje offset data konce bloku vůči dni začátku.

- Zobrazení: **"+Nd"** (zvýrazněný) pokud N > 0; **"+0d"** (průhledný/disabled styl)
  pokud N = 0
- Je vždy přítomný vedle pole "Konec" (i při +0d)
- **tabIndex=-1** — není součástí Tab flow; dostupný pouze šipkami z pole Konec
- Na adjusteru s focusem:
  - Šipka nahoru nebo vpravo: +1d (posune datum konce o jeden den dál)
  - Šipka dolů nebo vlevo: −1d (posune datum konce o jeden den zpět); na hodnotě
    0d se šipka dolů/vlevo vrátí focus na poslední segment pole "Konec"
- Fyzická tlačítka ±1d (mouseclick) nejsou součástí Tab flow (tabIndex=-1)

#### Priorita

Celý blok priority je jeden focusovatelný element (div s tabIndex=0).

- Šipka vpravo: posune vybranou prioritu doprava (none → low → medium → high);
  zastaví se na hranici
- Šipka vlevo: posune vybranou prioritu doleva (high → medium → low → none);
  zastaví se na hranici
- Vizuální border u vybrané priority se zobrazuje **pouze pokud má celý blok
  focus** — při navigaci myší border není vidět

#### Globální zkratky v popovert

| Zkratka | Akce |
|---|---|
| Ctrl+Enter | Uložit a zavřít (ekvivalent tlačítka "Hotovo") — funguje kdekoliv v popovert |
| Delete | Otevře inline confirm dialog pro smazání bloku (mimo text inputy) |
| Escape | Pokud je otevřen confirm dialog: zavře confirm dialog. Jinak: zavře popover bez uložení. |

### 5.14 Quick Notes — rychlé poznámky z inboxu

#### Spouštěč

Logika pro rozlišení task vs. poznámka je sdílená přes hook `useQuickAdd` a funguje identicky na obou entry pointech:

- **Desktop:** `AddTaskInput` — inline input ve sloupci inboxu, aktivuje se kliknutím na "+ Přidat"
- **Mobil:** `QuickAddSheet` — bottom sheet, aktivuje se FAB tlačítkem (+)

Výchozí režim inputu je poznámka. Pokud text začíná prefixem `//`, vstup se přepne do režimu tasku:

- Placeholder v výchozím (poznámkovém) režimu: "Rychlá poznámka… (// = úkol)"
- Při aktivním `//` prefixu se placeholder změní na "Název úkolu…"
- Vizuální styl inputu se mírně odliší — signal, že jde o jiný typ záznamu
- Tlačítko "+ Přidat" (zavřený stav inputu) zůstává beze změny
- Na mobilu se label `QuickAddSheet` dynamicky mění: "Nová poznámka" → "Nový úkol"

#### Chování při uložení

- Enter bez prefixu vytvoří nový záznam v tabulce `note` (viz sekce 4.6) se statusem `new`
- Enter s prefixem `//` vytvoří nový task (viz sekce 4.1)
- Prefix `//` se do obsahu tasku neukládá — ukládá se jen text za ním
- Prázdný text (nebo pouze `//`) se neuloží — stejné chování jako u prázdného vstupu

#### Co se s poznámkami děje dál

MVP fáze: poznámky se ukládají do DB, ale zatím se v UI nezobrazují — funkce pro prohlížení a zpracování poznámek je budoucí feature. Datový model (`converted_task_id`, status `reviewed`) je připraven pro pozdější Review mode (viz sekce 14).

### 5.15 WelcomeCard — onboarding prázdného inboxu

#### Podmínky zobrazení

WelcomeCard se zobrazí v inboxovém sidebaru, pokud jsou splněny **obě** podmínky:
1. Inbox je prázdný (žádné tasky ani poznámky)
2. Uživatel kartu dosud nedismissnul (`flowblock_welcome_dismissed` v localStorage není nastaveno)

Jakmile uživatel přidá první úkol nebo poznámku (inbox přestane být prázdný), karta zmizí automaticky — podmínka prázdnosti přestane být splněna.

#### Vizuální styl

"Paper-note" styl — mírně odlišné pozadí od okolního inboxu (`rgba(26,26,46,0.02)`), subtle box-shadow. Zapadá do "warm paper-industrial" estetiky a nepůsobí jako systémová notifikace.

#### Obsah

```
┌──────────────────────────────────┐ ×
│  Sem patří vše,                  │
│  co ti teď leží v hlavě.         │
│  Napiš úkol, přetáhni ho        │
│  do kalendáře a máš plán.        │
│                                  │
│  [ Název prvního úkolu…  Enter→] │
│                                  │
│  nebo načíst ukázkový den        │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│  Data zůstávají v tvém prohlížeči│
│  zapnout synchronizaci ? Evolu   │
│                          Přehled │
└──────────────────────────────────┘
```

- **Nadpis:** "Sem patří vše, co ti teď leží v hlavě." (Instrument Serif italic)
- **Podtitulek:** "Napiš úkol, přetáhni ho do kalendáře a máš plán. Tak jednoduché to je."
- **Inline input** s `autoFocus` — uživatel může začít psát okamžitě bez kliknutí
  - Placeholder: "Název prvního úkolu…" (nebo "Rychlá poznámka…" pokud text začíná `//`)
  - Enter uloží záznam (přes `useQuickAdd`, stejná logika jako `AddTaskInput`) a automaticky dismissne kartu
  - Escape dismissne kartu bez uložení
  - Hint "Enter →" zobrazen jako ztlumený text uvnitř inputu vpravo
- **Sekundární CTA:** "nebo **načíst ukázkový den**" — vloží 5 demo tasků + 3 timeblocks s dnešními časy; poté kartu dismissne
- **Dělicí čára** (dashed)
- **Footer:**
  - Privacy řádek: "Data zůstávají v tvém prohlížeči, případně lze zapnout synchronizaci pomocí Evolu"
  - "zapnout synchronizaci" — odkaz, který otevře SettingsModal s `highlightSync=true` (scrolluje a highlightuje sekci Pokročilé)
  - `?` tooltip vedle "Evolu" — vysvětluje co Evolu je (open-source local-first DB, volitelná E2E synchronizace, žádný vendor lock-in)
  - "Přehled funkcí" — odkaz vpravo; otevře HelpModal

#### Dismiss

- Tlačítko `×` v pravém horním rohu — dismissne kartu, uloží příznak do localStorage; karta se nevrátí
- Po dismissu (jakýmkoliv způsobem) se `flowblock_welcome_dismissed = "1"` zapíše do localStorage

#### Demo data (načíst ukázkový den)

Vloží ukázkový obsah s dnešními časy pro ilustraci workflow:

**Tasky:**

| Název | Priorita | Energie |
|---|---|---|
| Odpovědět Martinovi na nabídku | high | draining |
| Koupit dárek pro Lucii | medium | normal |
| Přečíst článek o produktivitě | low | lite |
| Zavolat zubařovi | none | normal |
| Nákup — mléko, chléb, káva | none | lite |

**TimeBlocks (dnešní datum, relativní časy):**

| Název | Začátek | Konec | Priorita |
|---|---|---|---|
| Odpovědět Martinovi na nabídku | 09:00 | 10:00 | high |
| Administrativa | 10:30 | 11:00 | medium |
| Přečíst článek o produktivitě | 14:00 | 14:30 | low |

### 5.16 HelpModal — přehled funkcí a zkratek

#### Spouštěče

HelpModal lze otevřít ze dvou míst:
1. **Header** — ikona `?` v hlavní liště (vedle ikony ⚙ Nastavení)
2. **WelcomeCard** — odkaz "Přehled funkcí" v footeru karty (viz sekce 5.15)

#### Forma

Modal (`z-index: 90`) s poloprůhledným překrytím pozadí (`z-index: 80`). Šířka max. `28rem`, max. výška `80vh` s vnitřním scrollem. Zavírá se kliknutím na překrytí nebo tlačítkem `×`.

#### Obsah — sekce

Sekce jsou seřazeny podle frekvence použití:

**Inbox**

| Akce | Klávesa / gesta |
|---|---|
| Přidat nový úkol | Enter |
| Přidat poznámku místo úkolu | `//` + Enter |
| Editovat úkol inline | klik na název |
| Nastavit prioritu úkolu | ikona vlajky |
| Naplánovat úkol | drag do kalendáře |

**Kalendář**

| Akce | Klávesa / gesta |
|---|---|
| Vytvořit nový timeblock | double-click |
| Naplánovat úkol na konkrétní čas | drag z inboxu |
| Přiřadit úkol k existujícímu bloku | drag z inboxu na blok |
| Přesunout timeblock na jiný čas nebo den | drag bloku |
| Změnit délku bloku tažením | tažení okraje bloku |
| Otevřít detail bloku | klik na blok |

**Detail bloku**

| Akce | Klávesa |
|---|---|
| Uložit změny | Ctrl+Enter |
| Zavřít bez uložení | Esc |
| Smazat blok | Del |
| Změnit prioritu bloku | ← → |
| Propojit / odpojit úkol | ikona odkazu |

**Navigace**

| Akce | Klávesa |
|---|---|
| Zavřít otevřený panel nebo modal | Esc |

#### Footer

Privacy poznámka: "Data jsou uložena lokálně v tvém prohlížeči. Sync mezi zařízeními lze zapnout v Nastavení."

---

## 6. Tech Stack

| Vrstva | Technologie | Poznámka |
|---|---|---|
| UI framework | React | Evolu má nativní React hooks |
| Local DB + sync | [Evolu](https://evolu.dev) | SQLite + CRDT, E2E encrypted relay |
| Typový systém | TypeScript | Evolu vyžaduje, Kysely pro type-safe SQL |
| Ext. kalendáře | TBD | Vlastní fetch wrapper (CalDAV REPORT + ICS polling) |
| Drag & drop | HTML5 Drag API | Vlastní implementace s overlay mechanikou |
| Styling | TBD | Tailwind / CSS Modules / jiné |

---

## 7. MVP Scope — vrstvy implementace

### Vrstva 1: Datový model + základní UI
- [x] Evolu schéma (Tasks, TimeBlocks)
- [x] Dashboard — "Co teď" blok, inbox, nadcházející, projekty, kapacitní lišta
- [x] Kalendářové sloupce (dnes + zítra) jako drop target
- [x] Týdenní pohled (sekundární, přepínatelný)
- [x] Drag tasku z inboxu do kalendáře (ghost + tooltip)
- [x] Drag ghost — prioritní pruh, čas, titul; custom ghost pro inbox drag; potlačený nativní drag image — viz sekce 5.6
- [x] Kolizní layout time-bloků (překrývající se bloky vedle sebe, greedy sweepline; two-layout při dragu) — viz sekce 5.6
- [x] Drag time-blocku v kalendáři (přesun slot/den)
- [x] Drag time-blocku zpět do inboxu
- [x] Resize time-blocku (kruhové handles, 15min snap)
- [x] Barvy time-bloků dle priority
- [x] Splnění úkolu (checkbox → Done)
- [x] Priority UI — barevný pruh v inboxu + inline popover pro nastavení (viz sekce 5.12)
- [x] Kapacitní lišta responzivní při resize/drag — lokální live update bez zápisu do DB (viz sekce 5.6, 5.7)
- [x] Dashboard reaktivita — automatická aktualizace "Co teď" a "Nadcházející" každou minutu (viz sekce 5.2)
- [x] Detail time-bloku — popover (viz sekce 5.13)
- [x] Dark mode — přepínač v Nastavení, systémová detekce, localStorage persistence (viz sekce 5.4, 5.9)
- [x] Vlastní Evolu relay URL — konfigurace v Nastavení, Pokročilé (viz sekce 5.9)
- [x] Formát času — toggle 24h / 12h AM·PM v Nastavení → Vzhled, localStorage persistence (viz sekce 5.9)
- [x] Inline confirm dialog + klávesa `Del` při smazání time-bloku — viz sekce 5.13
- [x] Quick Notes — rychlé záznamy z inboxu; výchozí = poznámka, prefix `//` = task (viz sekce 4.6, 5.14)
- [x] Sjednocení task/note entry přes `useQuickAdd` hook — desktop (`AddTaskInput`) i mobil (`QuickAddSheet`) funkčně identické (viz sekce 5.14)
- [x] Mobilní inbox — `TaskItem` a `NoteItem` sdílené s desktopem; touch-always-visible akce (viz sekce 5.8)
- [x] WelcomeCard — onboarding prázdného inboxu s inline inputem, demo daty a odkazy do HelpModal a Nastavení (viz sekce 5.15)
- [x] HelpModal — přehled funkcí a klávesových zkratek; dostupný z Headeru i WelcomeCard (viz sekce 5.16)
- [x] SettingsModal `highlightSync` — kontextové zvýraznění sekce Identita (Evolu) při příchodu z WelcomeCard (viz sekce 5.9)
- [x] Sync toggle "Povolit synchronizaci" v Nastavení → Identita (výchozí: vypnuto) — viz sekce 5.9
- [x] Okamžitý start bez loading screenu (`useQuerySubscription` nesuspenduje) — viz sekce 5.0
- [ ] Sekce Plánování v Nastavení — přestávka mezi bloky (transition buffer zóny) dočasně odstraněna, bude reimplementována; zkratkové hinty funkční (viz sekce 5.6, 5.9)
- [x] Vytvoření TimeBlocku double-click + drag v kalendáři (bez tažení = 60min blok, s tažením = custom délka; viz sekce 5.6)
- [x] Vizuální rozlišení prázdného vs. linked bloku — dashed/solid border, opacita, `ListTodo` ikona (viz sekce 5.5)
- [x] Přiřazení tasku přetažením na existující blok v kalendáři — ring highlight při hoveru (viz sekce 5.6)
- [x] Task search dropdown v detail popovert — vyhledávání, přiřazení, změna a odpojení tasku (viz sekce 5.13)

### Vrstva 2: Integrace externích kalendářů (read-only)
- [x] Připojení k CalDAV serveru (konfigurace URL + credentials) → čtení VEVENT → ExternalEvents
- [x] Přidání veřejného ICS feedu (URL) → stažení a parsování → ExternalEvents
- [x] Zobrazení externích událostí v kalendářovém pohledu (dashed styl)
- [ ] Inkrementální sync pro CalDAV (sync-token)
- [x] Polling pro ICS feedy (periodické přestahování, konfigurovatelný interval)
- [x] Sync tlačítko v Headeru (manuální sync všech kalendářů, spinning stav, chybová tečka) — viz sekce 5.10
- [x] Toast notifikace pro sync události (přidání kalendáře, manuální sync, chyby) — viz sekce 5.11
- [x] Per-kalendář sync tlačítko a persistent chybový stav v SettingsModal — viz sekce 5.9 a 5.11
- [x] Rozšíření Toast systému o typ `error` (červený, 6s, zavírací tlačítko)

### Vrstva 3: ADHD vylepšení
- [x] Notifikace přechodů mezi time-blocky (viz useBlockTransitionNotifications)

### Budoucí rozšíření (mimo MVP)
- Command bar s natural language parsing
- Varování při přeplánování dne (energy-aware, viz sekce 11)
- Tiché přesunutí nesplněných úkolů na další den
- Animace/zvuky při splnění úkolu (dopaminová odměna)
- **Projekty** (viz sekce 9)
- **Rutiny / opakující se šablony** (viz sekce 10)
- **Energetická náročnost úkolů** (viz sekce 11)
- **Blockery / závislosti** (viz sekce 12)
- **Smart suggestions** (viz sekce 13)
- **Review mode** (viz sekce 14)
- **Plugin systém** (viz sekce 15)
- **Lokální bridge API** (viz sekce 16)
- **Natural language input** (viz sekce 17)
- **i18n a a11y** (viz sekce 18)
- **AI integrace** (Ollama + volitelné gatewaye) (viz sekce 19)
- Štítky / filtry
- Integrace s dalšími službami (email, Slack...)
- Denní / měsíční pohled
- Statistiky a reporty

---

## 8. Otevřené otázky

- [x] Konkrétní open-source licence — WTFPL
- [ ] Název projektu (FlowBlock je pracovní)
- [x] Ext. kalendáře — JS/TS ICS parser: ical.js (implementováno)
- [x] Styling framework — Tailwind CSS
- [ ] Deployment strategie — PWA jako primární mobilní/desktop řešení, statický hosting
- [ ] Testovací CalDAV server pro vývoj (Radicale? Baikal?)

---

## 9. Budoucí feature: Projekty

### Motivace

ADHD mozek má tendenci hyperfokusovat na jeden projekt a zapomínat na ostatní. Cíl projektového systému je zajistit, aby žádný projekt nezapadl, bez toho aby uživatel musel aktivně přepínat kontext nebo spravovat priority.

### Datový model

Viz sekce 4.5. Klíčový sloupec je `weight` (float) — rotační váha projektu.

### Voting / rotační mechanismus

Základní princip: váha projektu roste pasivně časem a klesá při každém zobrazení nebo výběru.

```
weight += čas_od_posledního_zobrazení * koeficient_růstu
weight -= konstanta_při_zobrazení
```

Efekt: projekty, na které se dlouho nesáhlo, se přirozeně vyplaví na povrch. Žádné explicitní prioritizování, žádná rozhodovací paralýza.

**Alternativa k zvážení:** Eisenhowerova matice (urgentní × důležitý) jako doplněk nebo náhrada votingu — jednodušší mentální model pro uživatele, kteří chtějí explicitní kontrolu.

### UI dopad

- Inbox zobrazuje projekty jako sbalitelné skupiny úkolů
- Pořadí skupin odpovídá `weight` (nejvyšší nahoře)
- Každý projekt má barvu (slouží jako vizuální kotva)
- Přidání úkolu do projektu: výběr při vytváření nebo drag & drop do skupiny

---

## 10. Budoucí feature: Rutiny / opakující se úkoly

### Problém

ADHD mozek potřebuje strukturu víc než neurotypický, protože si ji nedokáže vytvořit sám. Existující řešení (Habitica, Streaks...) používají streak-based systém, který je pro ADHD toxický: přerušíš streak → stud → vyhýbání se appce → konec. Rigidní denní povinnosti jsou demotivující.

### Navrhované řešení: Šablony dne

Rutiny jako předvyplněné šablony, ne jako povinnosti:

- **RecurringTemplate** — nová entita definující opakující se blok (např. "Ranní rutina", "Cvičení", "Review inboxu")
- Šablona má: název, výchozí délku, frekvenci (denně / konkrétní dny), preferovaný čas
- Každý den se z šablon automaticky vygenerují TimeBlocky, ale ty jsou **plně editovatelné** — uživatel je může posunout, zkrátit, nebo smazat bez jakéhokoliv trestu
- **Žádný streak counter**, žádné "3/7 dní tento týden"
- Volitelná jemná vizualizace typu "tohle děláš posledních X dní" — informativní, ne hodnotící

### Datový model (koncept)

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `title` | NonEmptyString1000 | Název rutiny |
| `duration_minutes` | Int | Výchozí délka |
| `recurrence` | `daily` \| `weekdays` \| `custom` | Frekvence |
| `recurrence_days` | Int[] (nullable) | Konkrétní dny (0=Po, 6=Ne) pro `custom` |
| `preferred_time` | Time (nullable) | Preferovaný čas v dni |
| `active` | Boolean | Zda se šablona aktivně generuje |

---

## 11. Budoucí feature: Energetická náročnost úkolů

### Problém

Většina plánovačů ignoruje, že úkoly mají různou kognitivní zátěž. Telefonát na úřad trvá 10 minut, ale ADHD mozek z něj může být vyčerpaný na hodinu. Naopak 3 hodiny kódování můžou být energeticky lehké, protože aktivují hyperfokus.

Příklady "manuálně jednoduchých, ale ADHD vyčerpávajících" úkolů:
- Telefonáty (zvlášť na úřady)
- Administrativa a formuláře
- E-maily vyžadující diplomatickou odpověď
- Rozhodování (vybrat pojištění, porovnat tarify...)
- Cokoliv s nejasným prvním krokem

### Navrhované řešení

Nový sloupec `energy` v Tasks s třemi úrovněmi:

- **`lite`** — rutinní, nevyžaduje soustředění (zalít kytky, nakoupit)
- **`normal`** — default, nemusíš nastavovat (většina úkolů)
- **`draining`** — kognitivně náročné, i když krátké (telefonáty, administrativa)

**Integrace s kapacitní lištou:** lišta nezobrazuje jen čas, ale i energetickou zátěž. Draining úkoly zabírají víc "kapacity" než lite úkoly. Varování při přeplánování zohledňuje energy, ne jen hodiny.

**Klíčový princip:** default je `normal`, takže uživatel nemusí nic nastavovat, pokud nechce. Žádné nucené rozhodování.

---

## 12. Budoucí feature: Blockery / závislosti

### Problém

Spousta úkolů má skrytou strukturu: nemůžeš udělat B, dokud neuděláš A. Ty blokující A-čka jsou často právě draining úkoly, které odkládáš — a tím blokuješ celý řetězec.

### Navrhované řešení: Zjednodušený model

Plnohodnotný dependency graph (A blokuje B blokuje C) je příliš komplexní na implementaci i UX. Místo toho jednoduchý flag:

- **`waiting_for`** — nullable string pole v Tasks. Pokud je vyplněné, úkol čeká na někoho/něco jiného (např. "čekám na odpověď od Jany", "čekám na schválení")
- Pokud je `waiting_for` null → "ball is in my court" — já jsem ta, kdo blokuje

### UI dopad

- Úkoly s `waiting_for = null` (tj. na mně závisí postup) se zobrazují **výrazněji** v inboxu
- Úkoly s vyplněným `waiting_for` se vizuálně **ztlumí** — nejsou actionable, dokud nepřijde odpověď
- Volitelný filtr "Čeká na mě" pro rychlý pohled na to, co můžeš reálně udělat

---

## 13. Budoucí feature: Smart suggestions (late-stage)

### Problém

Základní ADHD otázka: **"Co mám dělat TEĎ?"** — rozhodovací paralýza při pohledu na inbox plný úkolů.

### Navrhované řešení

Appka kombinuje dostupné signály a navrhne 1–3 úkoly, na které se zaměřit:

- **Čas:** kolik volného času zbývá v aktuálním dni
- **Energie:** aktuální stav (ráno = víc kapacity na draining úkoly)
- **Blockery:** upřednostnit úkoly, které blokují ostatní
- **Rutiny:** připomenout nezaplánované rutiny
- **Projekty:** rotační váha zajistí, že zapomenuté projekty vyplují

### Forma

- Jednoduchý widget "Navrhuju: [úkol]" s jedním kliknutím pro zaplánování
- Ne agresivní, ne povinné — suggestion, ne příkaz
- Toto je **late-stage feature**, vyžaduje funkční implementaci energií, blockerů a rutin

---

## 14. Budoucí feature: Review mode (inbox triage)

### Problém

Inbox se plní random postřehy a nápady. Na konci dne (nebo týdne) je v něm chaos a pohled na dlouhý seznam je paralyzující. Chybí strukturovaný způsob, jak si projít nahromaděné úkoly a rozhodnout, co s nimi.

### Navrhované řešení

**Review mode** — kurátorský režim inboxu, který ukazuje jeden úkol najednou:

- Appka postupně prezentuje každý nerozřazený úkol
- U každého uživatel volí akci: **zaplánovat** (přetáhne do kalendáře) / **nechat uzrát** (status `someday`) / **smazat**
- Jeden úkol najednou = žádný overwhelm ze seznamu
- Volitelně spustitelný přes tlačítko "Review inbox" nebo automatický prompt na konci dne

### Status `someday`

Nový stav úkolu pro věci, se kterými si zatím nevíš rady, ale nechceš je ztratit:

- Úkoly se statusem `someday` se nezobrazují v hlavním inboxu (snižuje vizuální šum)
- Dostupné přes filtr nebo samostatný pohled "Someday / Maybe"
- Review mode je periodicky zařadí zpět k posouzení — "pořád chceš tenhle úkol?"

---

## 15. Budoucí feature: Plugin systém

### Záměr

Umožnit rozšiřitelnost appky bez nutnosti forkovat kód. Plugin systém **nebude navrhován předem** — správný přístup je stavět appku modulárně (čisté rozhraní mezi vrstvami) a plugin API extrahovat později, až budou reálné use-casy.

### Principy

- Pluginy by měly mít přístup k datové vrstvě (read/write přes definované rozhraní)
- Možnost přidávat vlastní pohledy, akce v inboxu, nebo integrace
- Sandboxing — plugin nesmí rozbít core funkcionalitu
- Konkrétní API specifikace vznikne až po stabilizaci core features

---

## 16. Budoucí feature: Lokální bridge API

### Problém

Local-first architektura (Evolu) znamená, že data žijí v browseru — neexistuje server s REST endpointem. Pro integraci s desktopovými nástroji nebo skripty ale uživatel potřebuje způsob, jak se k datům dostat programaticky.

### Navrhované řešení

Lokální bridge — lehký proces běžící na uživatelově stroji, který vystavuje API nad Evolu daty:

- Přístup k úkolům, time-blockům a kalendářům přes lokální HTTP endpoint (např. `localhost:PORT`)
- Read i write operace
- Umožní integraci s CLI nástroji, desktop automatizací, nebo vlastními skripty
- CalDAV zůstává primárním "API do vnějšího světa" pro kalendářové klienty
- Bridge je doplňkový kanál pro programatický přístup mimo CalDAV

### Poznámka

Toto vyžaduje komponentu mimo browser (Node.js server, Tauri sidecar, nebo podobné). Scope a technologie budou upřesněny později.

---

## 17. Budoucí feature: Natural language input

### Problém

Vytváření úkolu vyžaduje vyplnění několika polí (název, čas, priorita, energy...). Pro ADHD mozek je každé rozhodování navíc bariéra. Ideálně by stačilo napsat jednu větu a appka by z ní vytáhla všechny atributy.

### Navrhované řešení

Jednořádkový input (v inboxu nebo command baru) s parsováním přirozeného jazyka. Nevyžaduje AI — stačí jednoduchý regex/pattern matcher.

### Syntaxe (návrh)

| Vzor | Atribut | Příklad |
|---|---|---|
| prostý text | `title` | `Zavolat doktorovi` |
| `v HH:MM` nebo `v HHh` | `start` (dnes) | `v 14:00`, `v 20h` |
| `zítra`, `ve středu`, `za 3 dny` | `due_date` / den pro time-block | `zítra v 10h` |
| `XXmin` nebo `XXh` | délka time-blocku | `30min`, `1.5h` |
| `p1` / `p2` / `p3` | `priority` (high/medium/low) | `p1` |
| `!draining` / `!lite` | `energy` | `!draining` |
| `@Jméno` | `waiting_for` | `@Jana` |

### Příklady

```
K doktorovi v 20h p1
→ title: "K doktorovi", start: dnes 20:00, priority: high

Napsat report zítra 2h p2
→ title: "Napsat report", date: zítra, duration: 2h, priority: medium

Zavolat na pojišťovnu !draining 15min
→ title: "Zavolat na pojišťovnu", energy: draining, duration: 15min

Čekat na fakturu @Petr
→ title: "Čekat na fakturu", waiting_for: "Petr"
```

### Poznámky

- Nerozpoznané části se stávají součástí `title`
- Parser by měl být tolerantní k pořadí — atributy mohou být kdekoliv ve větě
- Při parsování se zobrazí **preview** — uživatel vidí, jak appka rozuměla vstupu, než potvrdí
- Lokalizace: parser by měl rozumět českým i anglickým klíčovým slovům (`zítra` i `tomorrow`)

---

## 18. Budoucí feature: i18n a přístupnost (a11y)

### i18n — vícejazyčnost

MVP je v češtině. Budoucí podpora minimálně:
- **čeština** (výchozí)
- **angličtina**

Implementační přístup: i18n knihovna (např. i18next nebo Lingui) s oddělením řetězců do lokalizačních souborů. Přepínač jazyka v Nastavení → Vzhled (nebo samostatná sekce Formáty). Formát data a času respektuje zvolený jazyk / locale.

### a11y — přístupnost

- **Screen reader podpora:** sémantické HTML, ARIA role a labely na interaktivních prvcích (drag handles, time-blocky, priority popovert)
- **Keyboard navigation:** plná ovladatelnost klávesnicí — inbox, nastavení, modaly; drag & drop má klávesnicovou alternativu (přesun bloku šipkami)
- **Reduced motion:** animace (konfety, přechody) se vypnou nebo zjednodušší pokud uživatel má nastaveno `prefers-reduced-motion: reduce` — konfety již implementovány s touto podporou; ostatní animace budou postupně doplněny
- **Kontrast:** barevná paleta (světlý i tmavý režim) musí splňovat WCAG AA (kontrast text/pozadí minimálně 4.5:1)

---

## 19. Budoucí feature: AI integrace

### Filozofie

AI je volitelný doplněk, nikdy závislost. Appka musí být plně funkční bez jakéhokoliv AI modelu. Priorita: lokální modely před cloudovými — v souladu s local-first principem a ochranou soukromí (úkoly a plány jsou citlivá data).

### Podporované backendy

| Backend | Typ | Poznámka |
|---|---|---|
| [Ollama](https://ollama.com) | lokální | Preferovaný — model běží na počítači uživatele, žádná data neopustí zařízení |
| OpenAI API | cloud (gateway) | Volitelný; uživatel zadá vlastní API klíč |
| Anthropic API | cloud (gateway) | Volitelný; uživatel zadá vlastní API klíč |
| Vlastní OpenAI-kompatibilní endpoint | cloud / lokální | Pro pokročilé uživatele (LM Studio, Jan, atd.) |

Konfigurace v Nastavení — nová sekce "AI". Uložení API klíčů lokálně (localStorage nebo Evolu, nikdy odesíláno na FlowBlock servery — ty neexistují).

### Případy užití

- **Smart suggestions** (rozšíření sekce 13) — návrh bloků a priorit na základě obsahu inboxu, denní kapacity a energetické náročnosti
- **Shrnutí dne** — krátký přehled co bylo splněno, co se přesunulo, co čeká
- **Natural language parsing** (rozšíření sekce 17) — AI jako fallback pro složitější vstupy, které regex parser nezvládne
- **Prioritizační asistent** — na vyžádání navrhne prioritu nebo energetický label pro nový úkol

### Poznámky k implementaci

- Všechny AI funkce jsou explicitně spouštěny uživatelem (žádné automatické pozadí)
- Odpovědi AI jsou vždy návrhy — uživatel je přijme nebo odmítne jedním kliknutím
- Pokud AI backend není nakonfigurován, funkce se tiše skryjí (žádné "nastavte AI")
