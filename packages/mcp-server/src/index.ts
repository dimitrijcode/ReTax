import {
  calendarListEvents,
  gmailGetAttachment,
  gmailGetMessage,
  gmailSearchMessages,
  invoiceExtract,
  taxClassifyAsset,
  taxComputePlan,
} from "./tools";

export type RetaxMcpServer = {
  name: "retax";
  version: string;
  transport: "in-process";
  tools: string[];
};

/**
 * Fixture-backed tool functions used by the web orchestrator in-process.
 * A stdio/HTTP MCP transport is not required for the fixture demo.
 */
export function createServer(): RetaxMcpServer {
  return {
    name: "retax",
    version: "0.1.0",
    transport: "in-process",
    tools: [
      "calendar_list_events",
      "gmail_search_messages",
      "gmail_get_message",
      "gmail_get_attachment",
      "invoice_extract",
      "tax_classify_asset",
      "tax_compute_plan",
    ],
  };
}

export {
  calendarListEvents,
  gmailGetAttachment,
  gmailGetMessage,
  gmailSearchMessages,
  invoiceExtract,
  taxClassifyAsset,
  taxComputePlan,
};

export type {
  FixtureCalendarEvent,
  FixtureGmailMessage,
  GmailMessageSummary,
} from "./tools";

export {
  extractInvoice,
  INVOICE_EXTRACT_MODEL,
  INVOICE_JSON_SCHEMA,
  INVOICE_TOOL_DESCRIPTION,
  InvoiceExtractError,
  parseInvoiceJson,
  registerInvoiceTools,
} from "./tools/invoice.js";
export type {
  ExtractedInvoice,
  InvoiceExtractErrorCode,
  InvoiceItem,
  InvoiceLlmClient,
  PdfRef,
} from "./tools/invoice.js";
