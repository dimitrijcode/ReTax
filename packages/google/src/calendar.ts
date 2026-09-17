import type { calendar_v3 } from "googleapis";
import { google } from "googleapis";
import type { OAuth2Client } from "./oauth";

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  description: string;
  location: string;
};

export type ListEventsParams = {
  from: Date | string;
  to: Date | string;
  query?: string;
  auth?: OAuth2Client;
};

function requireAuth(auth?: OAuth2Client): OAuth2Client {
  if (!auth) {
    throw new Error("An authenticated OAuth2 client is required. Call getAuthenticatedClient(tokens) first.");
  }
  return auth;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapEvent(event: calendar_v3.Schema$Event): CalendarEvent | null {
  if (!event.id || event.status === "cancelled") return null;
  return {
    id: event.id,
    summary: event.summary ?? "",
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    description: event.description ?? "",
    location: event.location ?? "",
  };
}

export async function listEvents({ from, to, query, auth }: ListEventsParams): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: "v3", auth: requireAuth(auth) });
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: toIso(from),
      timeMax: toIso(to),
      q: query,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      pageToken,
    });

    for (const item of res.data.items ?? []) {
      const mapped = mapEvent(item);
      if (mapped) events.push(mapped);
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}
