import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Invoice } from "@retax/tax-engine";
import { findRepoRoot } from "./root";

export type FixtureCalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  description: string;
  location: string;
};

export type FixtureGmailAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  path: string;
};

export type FixtureGmailMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  attachments: FixtureGmailAttachment[];
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  snippet: string;
};

function fixturesDir(): string {
  return join(findRepoRoot(), "fixtures");
}

function readJson<T>(name: string): T {
  const path = join(fixturesDir(), name);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadCalendarEvents(): FixtureCalendarEvent[] {
  return readJson<{ events: FixtureCalendarEvent[] }>("calendar.json").events;
}

export function loadGmailMessages(): FixtureGmailMessage[] {
  return readJson<{ messages: FixtureGmailMessage[] }>("gmail.json").messages;
}

export function loadInvoice(): Invoice {
  return readJson<Invoice>("invoice.json");
}

export function fixturePdfPath(): string {
  return join(fixturesDir(), "laptop-invoice.pdf");
}

export function toMessageSummary(message: FixtureGmailMessage): GmailMessageSummary {
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet,
  };
}
