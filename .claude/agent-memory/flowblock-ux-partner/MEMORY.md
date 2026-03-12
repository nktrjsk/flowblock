# FlowBlock UX Partner — Paměť agenta

## SPEC.md — stav a verze

- Aktuální verze: **0.11.0** (2026-03-12)
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

## Uživatelské preference
- Žádné zbytečné složitosti — YAGNI přístup schválen (vyčistit datový model)
- Prefer jednoduché řešení před komplexním (CalDAV write odstraněno z důvodu zbytečné komplexity)
