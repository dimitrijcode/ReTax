import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyAsset,
  computePlan,
  type Classification,
  type DepreciationMethod,
  type Invoice,
  type TaxPlan,
} from "@retax/tax-engine";
import { findRepoRoot } from "./root";
import {
  loadCalendarEvents,
  loadGmailMessages,
  loadInvoice,
  toMessageSummary,
  type FixtureCalendarEvent,
  type FixtureGmailMessage,
  type GmailMessageSummary,
} from "./fixtures";

export type { FixtureCalendarEvent, FixtureGmailMessage, GmailMessageSummary };

function matchesQuery(haystack: string, query?: string): boolean {
  if (!query?.trim()) return true;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = haystack.toLowerCase();
  return tokens.some((token) => {
    if (token.includes(":")) return true;
    return text.includes(token);
  });
}

export async function calendarListEvents(params?: {
  from?: string;
  to?: string;
  query?: string;
}): Promise<FixtureCalendarEvent[]> {
  const events = loadCalendarEvents();
  return events.filter((event) =>
    matchesQuery(`${event.summary} ${event.description} ${event.location}`, params?.query),
  );
}

export async function gmailSearchMessages(params?: {
  query?: string;
  maxResults?: number;
}): Promise<GmailMessageSummary[]> {
  const max = params?.maxResults ?? 10;
  const messages = loadGmailMessages().filter((message) =>
    matchesQuery(
      `${message.subject} ${message.snippet} ${message.body} ${message.from}`,
      params?.query,
    ),
  );
  return messages.slice(0, max).map(toMessageSummary);
}

export async function gmailGetMessage(id: string): Promise<FixtureGmailMessage> {
  const message = loadGmailMessages().find((item) => item.id === id);
  if (!message) throw new Error(`Fixture Gmail message not found: ${id}`);
  return message;
}

export async function gmailGetAttachment(params: {
  messageId: string;
  attachmentId: string;
}): Promise<{ filename: string; mimeType: string; pdfRef: string; data: Buffer }> {
  const message = await gmailGetMessage(params.messageId);
  const attachment = message.attachments.find((item) => item.attachmentId === params.attachmentId);
  if (!attachment) {
    throw new Error(`Fixture attachment ${params.attachmentId} not found on ${params.messageId}`);
  }
  const pdfRef = join(findRepoRoot(), attachment.path);
  return {
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    pdfRef,
    data: readFileSync(pdfRef),
  };
}

/** Fixture extract: returns the demo invoice JSON. Ignores Anthropic. */
export async function invoiceExtract(_pdfRef?: string): Promise<Invoice> {
  void _pdfRef;
  return loadInvoice();
}

export async function taxClassifyAsset(invoice: Invoice): Promise<Classification> {
  return classifyAsset(invoice);
}

export async function taxComputePlan(
  invoice: Invoice,
  businessSharePct: number,
  method?: DepreciationMethod,
): Promise<TaxPlan> {
  return computePlan(invoice, businessSharePct, method);
}
