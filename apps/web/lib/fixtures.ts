import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Invoice } from "@retax/tax-engine";
import { findRepoRoot } from "./repo-root";

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

export const FIXTURE_CALENDAR_EVENT: FixtureCalendarEvent = {
  id: "evt-laptop-2026",
  summary: "Laptop kaufen",
  start: "2026-09-12T10:00:00+02:00",
  end: "2026-09-12T11:00:00+02:00",
  description: "ThinkPad X1 Carbon bei TechHaus abholen und Rechnung mitnehmen.",
  location: "TechHaus Berlin, Friedrichstraße 123",
};

export const FIXTURE_GMAIL_MESSAGE: FixtureGmailMessage = {
  id: "msg-laptop-invoice",
  threadId: "thread-laptop-2026",
  from: "TechHaus Berlin GmbH <rechnung@techhaus.example>",
  subject: "Ihre Rechnung RE-2026-18472 — ThinkPad X1 Carbon",
  date: "Fri, 12 Sep 2026 14:22:00 +0200",
  snippet: "Anbei die Rechnung für Ihren Laptop (ThinkPad X1 Carbon) über 1.499,00 €.",
  body: "Anbei die Rechnung RE-2026-18472 für den Lenovo ThinkPad X1 Carbon Laptop.",
  attachments: [
    {
      filename: "laptop-invoice.pdf",
      mimeType: "application/pdf",
      attachmentId: "att-laptop-pdf",
      path: "fixtures/laptop-invoice.pdf",
    },
  ],
};

export const FIXTURE_INVOICE: Invoice = {
  vendor: "TechHaus Berlin GmbH",
  date: "2026-09-12",
  invoiceNumber: "RE-2026-18472",
  net: 1259.66,
  vat: 239.34,
  gross: 1499,
  currency: "EUR",
  items: [
    {
      description: "Lenovo ThinkPad X1 Carbon Laptop",
      net: 1259.66,
      vatRate: 0.19,
    },
  ],
  categoryHint: "Computerhardware/Notebook",
};

export function fixturePdfPath(): string {
  return join(findRepoRoot(), "fixtures", "laptop-invoice.pdf");
}

export function fixturePdfIfPresent(): string | null {
  const path = fixturePdfPath();
  return existsSync(path) ? path : null;
}
