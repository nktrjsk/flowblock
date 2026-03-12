import ICAL from "ical.js";
import * as Evolu from "@evolu/common";
import { evolu } from "../db/evolu";
import { CalendarId } from "../db/schema";

export interface ParsedEvent {
  uid: string;
  etag?: string;
  title: string;
  start: string;   // ISO 8601
  end: string;     // ISO 8601
  isAllDay: boolean;
}

function icalDateToISO(icalTime: ICAL.Time): string {
  return icalTime.toJSDate().toISOString();
}

function parseICALString(icsText: string): ParsedEvent[] {
  const parsed = ICAL.parse(icsText);
  const comp = new ICAL.Component(parsed);
  const vevents = comp.getAllSubcomponents("vevent");

  const events: ParsedEvent[] = [];
  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent);
      const uid = event.uid;
      if (!uid) continue;

      const dtstart = event.startDate;
      if (!dtstart) continue;
      const dtend = event.endDate ?? dtstart;

      const isAllDay = dtstart.isDate;

      let endISO: string;
      if (isAllDay) {
        // DTEND for all-day is exclusive (next day), subtract 1ms
        const endDate = dtend.toJSDate();
        endDate.setTime(endDate.getTime() - 1);
        endISO = endDate.toISOString();
      } else {
        endISO = icalDateToISO(dtend);
      }

      events.push({
        uid,
        title: event.summary ?? "(bez názvu)",
        start: icalDateToISO(dtstart),
        end: endISO,
        isAllDay,
      });
    } catch {
      // Skip malformed events
    }
  }
  return events;
}

export async function fetchICS(url: string): Promise<ParsedEvent[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ICS fetch selhal: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseICALString(text);
}

export async function fetchCalDAV(
  url: string,
  username: string,
  password: string,
): Promise<ParsedEvent[]> {
  const credentials = btoa(`${username}:${password}`);

  const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "REPORT",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/xml; charset=utf-8",
        Depth: "1",
      },
      body,
    });
  } catch (e) {
    const isNetworkError = e instanceof TypeError && e.message.includes("Failed to fetch");
    const msg = isNetworkError
      ? "CORS chyba — server blokuje browserové požadavky. Přidej CORS hlavičky na server nebo použij ICS feed."
      : String(e);
    throw new Error(msg);
  }

  if (!res.ok) {
    throw new Error(`CalDAV REPORT selhal: ${res.status} ${res.statusText}`);
  }

  const xmlText = await res.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  const responses = Array.from(xmlDoc.querySelectorAll("response"));
  const events: ParsedEvent[] = [];

  for (const response of responses) {
    const calData = response.querySelector("calendar-data")?.textContent;
    const etag = response.querySelector("getetag")?.textContent ?? undefined;
    if (!calData) continue;
    try {
      const parsed = parseICALString(calData);
      for (const ev of parsed) {
        events.push({ ...ev, etag });
      }
    } catch {
      // Skip malformed calendar data
    }
  }

  return events;
}

export async function upsertExternalEvents(
  calendarId: CalendarId,
  events: ParsedEvent[],
): Promise<void> {
  const existingQuery = evolu.createQuery((db) =>
    db
      .selectFrom("externalEvent")
      .select(["id", "caldav_uid", "caldav_etag"])
      .where("calendar_id", "=", calendarId)
      .where("isDeleted", "is", null),
  );

  const existing = await evolu.loadQuery(existingQuery);

  const existingByUid = new Map<string, typeof existing[number]>();
  for (const row of existing) {
    if (row.caldav_uid) existingByUid.set(row.caldav_uid, row);
  }

  const incomingUids = new Set(events.map((e) => e.uid));

  // Soft-delete events no longer in the feed
  for (const [uid, row] of existingByUid) {
    if (!incomingUids.has(uid)) {
      evolu.update("externalEvent", { id: row.id, isDeleted: 1 });
    }
  }

  for (const ev of events) {
    const found = existingByUid.get(ev.uid);
    const title = Evolu.NonEmptyString1000.orThrow(
      (ev.title || "(bez názvu)").slice(0, 999),
    );
    const start = Evolu.NonEmptyString100.orThrow(ev.start);
    const end = Evolu.NonEmptyString100.orThrow(ev.end);
    const etag = ev.etag
      ? Evolu.NonEmptyString1000.orThrow(ev.etag.slice(0, 999))
      : null;
    const isAllDay = ev.isAllDay ? (1 as const) : (0 as const);

    if (found) {
      // Skip if etag matches (unchanged)
      if (ev.etag && found.caldav_etag === ev.etag) continue;
      evolu.update("externalEvent", {
        id: found.id,
        caldav_etag: etag,
        title,
        start,
        end,
        is_all_day: isAllDay,
      });
    } else {
      const uid = (ev.uid || crypto.randomUUID()).slice(0, 999);
      evolu.insert("externalEvent", {
        calendar_id: calendarId,
        caldav_uid: Evolu.NonEmptyString1000.orThrow(uid),
        caldav_etag: etag,
        title,
        start,
        end,
        is_all_day: isAllDay,
      });
    }
  }

  // Update last_fetched_at
  evolu.update("calendar", {
    id: calendarId,
    last_fetched_at: Evolu.NonEmptyString100.orThrow(
      new Date().toISOString().slice(0, 20) + "Z",
    ),
  });
}

export interface CalendarRecord {
  id: CalendarId;
  type: string | null;
  url: string | null;
  username?: string | null;
  password?: string | null;
}

export async function syncCalendar(calendar: CalendarRecord): Promise<void> {
  const { id, type, url, username, password } = calendar;
  if (!type || !url) throw new Error("Kalendář nemá vyplněný typ nebo URL.");

  let events: ParsedEvent[];
  if (type === "ics") {
    events = await fetchICS(url);
  } else if (type === "caldav") {
    if (!username || !password) {
      throw new Error("CalDAV vyžaduje uživatelské jméno a heslo.");
    }
    events = await fetchCalDAV(url, username, password);
  } else {
    throw new Error(`Neznámý typ kalendáře: ${type}`);
  }

  await upsertExternalEvents(id, events);
}
