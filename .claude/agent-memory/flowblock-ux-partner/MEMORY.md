# FlowBlock UX Partner — Paměť agenta

## SPEC.md — stav a verze

- Aktuální verze: **0.14.0** (2026-03-13)
- Umístění: `/home/Nikita/projekty-v2/programovani/flowblock/SPEC.md`
- VŽDY přečti SPEC.md před návrhem jakékoliv změny

## Klíčová designová rozhodnutí

### CalDAV integrace (rozhodnuto 2026-03-12)
- FlowBlock je **read-only** — nezapisuje nic na CalDAV server
- Podporuje: CalDAV server (VEVENT) + veřejné ICS feedy (HTTP polling)
- ICS sync = polling (periodické přestahování), ne jednorázový import
- VTODO z CalDAV se ignorují — úkoly žijí výhradně v Evolu
- Vrstva 3 (CalDAV write) byla odstraněna ze scope

### Datový model
- Tasks: bez `caldav_uid`, bez `caldav_etag`
- TimeBlocks: bez `caldav_uid`, bez `caldav_etag`, bez `calendar_id`
- Calendars: má sloupec `type` (`caldav` | `ics`), `url` (obecné), `last_fetched_at`
- ExternalEvents: `caldav_uid` a `caldav_etag` ZŮSTÁVAJÍ (pro deduplikaci při read syncu)

### Styling
- Tailwind (rozhodnuto, ne CSS Modules)

## MVP vrstvy (aktuální scope)
1. Datový model + základní UI
2. Integrace externích kalendářů (read-only: CalDAV + ICS)
3. ADHD vylepšení (animace, tiché přesuny, notifikace)

### Sync feedback — stratifikace (rozhodnuto 2026-03-12)
- Toast POUZE pro explicitní akce (přidání kalendáře, manuální sync) — ne pro polling na pozadí
- Polling chyby = oranžová tečka na Sync tlačítku v Headeru + persistent text v SettingsModal
- Toast success = 2–2,5 s; Toast error = 6 s + ruční zavření
- Toast systém rozšířen o typ `error` (červený styl)
- Header Sync tlačítko = `RefreshCw` ikona, spinning při syncu, chybová tečka
- SettingsModal: per-kalendář sync tlačítko + persistent chybový text pod řádkem

### Priority UI (rozhodnuto 2026-03-13) — sekce 5.12
- Inbox: barevný vertikální pruh (2–3 px) na levém okraji řádku, barvy dle sekce 5.5
- Nastavení: ikona `Flag` (Lucide, 14px) při hoveru → miniaturní popover se 4 volbami
- Default `none` — uživatel není nucen prioritu nastavovat
- Time-blocky: zbarveny celým pozadím (sekce 5.5), žádný další element

### Kapacitní lišta — responzivita při drag/resize (rozhodnuto 2026-03-13) — sekce 5.6, 5.7
- DayCapacityBars se aktualizuje lokálně v reálném čase BEHEM resize i drag
- Finální zápis do Evolu az po mouseUp (stávající chování zachováno)
- Lokální live update = čistě vizuální, bez mezizápisů do DB

### Detail time-bloku (koncept, 2026-03-13) — sekce 5.13
- Status: KONCEPT — bude prototypovano, implementace az po schvaleni prototypu
- Forma: popover ukotven na bloku (preferovane vlevo), bottom sheet na mobilu
- Editovatelne: title, start/end (time pickery, 15min snap), priority, odpojeni ukolu
- Odpojeni ukolu → ukol zpet do inbox, blok se stane volnym (task_id = null)
- Priority bloku a ukolu jsou NEZAVISLE — zmena jednoho neovlivni druhy

### Editace kalendáře v SettingsModal (rozhodnuto 2026-03-13)
- Vzor: inline accordion pod řádkem kalendáře (ne modal-v-modalu)
- Editovatelná pole: `display_name`, `url`, `username`, `password`, `color`
- `type` není editovatelné — změna typu = smazat a přidat znovu
- V jednom okamžiku otevřen max. jeden formulář (edit nebo přidat)
- Ikona `Pencil` při hoveru, změní se na `X` při otevření
- Tlačítko "Uložit a synchronizovat" vždy spouští re-sync (bez rozlišení co se změnilo)
- Toast "Kalendář uložen" (zelený, 2,5 s)

## Workflow pravidla

### Povinný postup před zápisem do SPEC.md
1. **Návrh** — popsat záměr změny
2. **Diff** — ukázat přesně co se přidá/změní/odstraní (konkrétní text, ne jen popis)
3. **Schválení** — explicitní souhlas uživatelky před jakýmkoliv zápisem
4. **Zápis** do SPEC.md
5. **Commit**

Nikdy nezapisovat ani necommitovat bez ukázání diffu a čekání na schválení.

## Git konvence

- Commit messages VŽDY v angličtině

## Uživatelské preference
- Žádné zbytečné složitosti — YAGNI přístup schválen (vyčistit datový model)
- Prefer jednoduché řešení před komplexním (CalDAV write odstraněno z důvodu zbytečné komplexity)
- Polling na pozadí nesmí generovat toasty — ADHD anti-noise princip potvrzen
