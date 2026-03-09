# FlowBlock — ADHD-friendly Local-First Plánovač

> **Verze dokumentu:** 0.7 (2026-03-09)
> **Status:** Návrh MVP

---

## 1. Vize projektu

Open-source webová aplikace pro plánování času, inspirovaná [Akiflow](https://akiflow.com), navržená s ohledem na ADHD. Základní princip: **unified inbox + time-blocking kalendář** postavený na otevřených standardech (CalDAV) s local-first architekturou.

---

## 2. Klíčové principy

### 2.1 Open-source & open standardy
- Licence: WTFPL nebo jiná copyleft (ne GPL)
- CalDAV (RFC 4791) pro synchronizaci kalendářů
- iCalendar (RFC 5545) — VTODO pro úkoly, VEVENT pro time-blocky
- Žádný vendor lock-in — uživatel vlastní svá data

### 2.2 Local-first
- Data žijí primárně v lokální SQLite databázi (přes Evolu)
- Aplikace funguje offline
- Synchronizace mezi zařízeními přes Evolu relay server (CRDT, E2E šifrování)
- CalDAV sync jako bridge do externího ekosystému

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
│  │   Evolu   │    │ CalDAV      │  │
│  │ (lokální  │◄──►│ Sync Layer  │  │
│  │  SQLite)  │    │             │  │
│  └─────┬─────┘    └─────┬───────┘  │
│        │                 │          │
└────────┼─────────────────┼──────────┘
         │                 │
   Evolu Relay       CalDAV Server
   (multi-device)    (Nextcloud atd.)
```

### 3.2 Source of truth

**Evolu (lokální SQLite) je source of truth.** CalDAV sync layer je bidirectional bridge:
- Čte z Evolu → zapisuje do CalDAV serveru
- Přijímá změny z CalDAV → zapisuje do Evolu

### 3.3 CalDAV mapování

| Koncept v appce | iCalendar typ | Kdy vznikne |
|---|---|---|
| Úkol v inboxu | VTODO | Při vytvoření úkolu |
| Time-block v kalendáři | VEVENT | Při přetažení úkolu do kalendáře |
| Propojení | `RELATED-TO` property | VEVENT odkazuje na VTODO |
| Externí událost | VEVENT (read-only) | Při syncu z CalDAV |

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
| `caldav_uid` | String (nullable) | UID propojeného VTODO |
| `caldav_etag` | String (nullable) | Pro detekci změn na CalDAV serveru |
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
| `caldav_uid` | String (nullable) | UID propojeného VEVENT |
| `caldav_etag` | String (nullable) | Pro detekci změn |
| `calendar_id` | Calendar ID | Do kterého kalendáře patří |

### 4.3 Calendars

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | Evolu ID | Primární klíč |
| `caldav_url` | String | URL CalDAV kolekce |
| `display_name` | String | Název kalendáře |
| `color` | String | Barva pro UI |
| `sync_token` | String (nullable) | Pro inkrementální sync |

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

---

## 5. UI Layout

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

### 5.5 Barvy time-bloků dle priority

| Priorita | Pozadí | Border | Text |
|---|---|---|---|
| `high` | `#fee2e2` | `#f87171` | `#991b1b` |
| `medium` | `#fef3c7` | `#f59e0b` | `#92400e` |
| `low` | `#dbeafe` | `#60a5fa` | `#1e3a8a` |
| `none` | `#f1f5f9` | `#94a3b8` | `#334155` |
| external | `#f5f0e8` | `#1a1a2e55` dashed | `#1a1a2e66` |

### 5.6 Interakce

- **Drag tasku z inboxu** do kalendářového sloupce → vytvoří TimeBlock + změní status úkolu na `planned`
- **Drag time-blocku v kalendáři** → přesun na jiný slot/den; drag funguje z celé plochy bloku
  - Při dragu se zobrazí **ghost** (poloprůhledný dashed obrys) ukazující cílový slot
  - Vedle ghosta se zobrazí **tooltip s přesným časem** (`HH:MM – HH:MM`); tooltip se přepne na druhou stranu, pokud je blok ve dvou pravých sloupcích
  - Drop funguje i když je cílový čas překrytý jiným blokem (overlay mechanismus)
- **Drag time-blocku zpět do inboxu** → odstraní TimeBlock, vrátí úkol do stavu `inbox`; inbox se vizuálně zvýrazní (zelené pozadí + hint text) při přetahování bloku
- **Resize time-blocku** → kruhové handles (bílé kolečko, 22px, ikona `GripVertical` z Lucide) na horním a dolním okraji bloku, zobrazí se při hoveru; přichytávání na 15 min; resize a drag jsou vzájemně exkluzivní (resize neaktivuje drag)
- **Indikátor aktuálního času** → červená horizontální linka s kruhovým špendlíkem na levém okraji, zobrazuje se pouze ve sloupci aktuálního dne; aktualizuje se každou minutu
- **Scroll při načtení** → kalendář se automaticky odscrolluje tak, aby byl indikátor aktuálního času viditelný (vertikálně vycentrovaný)
- **Drop target grid:** 15minutový snap; čtvrthodinové linie vyznačeny tečkovaně v pozadí
- **Checkbox** → přesun do Done se satisfying toastem
- **+ Přidat úkol** → inline input přímo v inboxu; Enter uloží, Escape zruší

---

## 6. Tech Stack

| Vrstva | Technologie | Poznámka |
|---|---|---|
| UI framework | React | Evolu má nativní React hooks |
| Local DB + sync | [Evolu](https://evolu.dev) | SQLite + CRDT, E2E encrypted relay |
| Typový systém | TypeScript | Evolu vyžaduje, Kysely pro type-safe SQL |
| CalDAV komunikace | TBD | tcdav / vlastní fetch wrapper |
| Drag & drop | HTML5 Drag API | Vlastní implementace s overlay mechanikou |
| Styling | TBD | Tailwind / CSS Modules / jiné |

---

## 7. MVP Scope — vrstvy implementace

### Vrstva 1: Datový model + základní UI
- [ ] Evolu schéma (Tasks, TimeBlocks)
- [ ] Dashboard — "Co teď" blok, inbox, nadcházející, projekty, kapacitní lišta
- [ ] Kalendářové sloupce (dnes + zítra) jako drop target
- [ ] Týdenní pohled (sekundární, přepínatelný)
- [ ] Drag tasku z inboxu do kalendáře (ghost + tooltip)
- [ ] Drag time-blocku v kalendáři (přesun slot/den)
- [ ] Drag time-blocku zpět do inboxu
- [ ] Resize time-blocku (kruhové handles, 15min snap)
- [ ] Barvy time-bloků dle priority
- [ ] Splnění úkolu (checkbox → Done)

### Vrstva 2: CalDAV integrace (read)
- [ ] Připojení k CalDAV serveru (konfigurace URL + credentials)
- [ ] Čtení kalendářů a událostí → ExternalEvents
- [ ] Zobrazení externích událostí v kalendářovém pohledu (dashed styl)
- [ ] Inkrementální sync (sync-token)

### Vrstva 3: CalDAV integrace (write)
- [ ] Zápis TimeBlocků jako VEVENT na CalDAV server
- [ ] Zápis Tasks jako VTODO na CalDAV server
- [ ] RELATED-TO propojení mezi VTODO a VEVENT
- [ ] Bidirectional sync s conflict resolution (etag)

### Vrstva 4: ADHD vylepšení
- [ ] Kapacitní lišta (volný vs. zaplánovaný čas, barevná škála)
- [ ] Varování při přeplánování dne
- [ ] Tiché přesunutí nesplněných úkolů na další den
- [ ] Animace/zvuky při splnění
- [ ] Notifikace přechodů mezi time-blocky

### Budoucí rozšíření (mimo MVP)
- Command bar s natural language parsing
- **Projekty** (viz sekce 9)
- **Rutiny / opakující se šablony** (viz sekce 10)
- **Energetická náročnost úkolů** (viz sekce 11)
- **Blockery / závislosti** (viz sekce 12)
- **Smart suggestions** (viz sekce 13)
- **Review mode** (viz sekce 14)
- **Plugin systém** (viz sekce 15)
- **Lokální bridge API** (viz sekce 16)
- **Natural language input** (viz sekce 17)
- Štítky / filtry
- Integrace s dalšími službami (email, Slack...)
- Denní / měsíční pohled
- Statistiky a reporty

---

## 8. Otevřené otázky

- [ ] Konkrétní open-source licence (WTFPL nebo jiná copyleft, ne GPL)
- [ ] Název projektu (FlowBlock je pracovní)
- [ ] CalDAV knihovna — prozkoumat existující JS/TS implementace
- [ ] Styling framework
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
