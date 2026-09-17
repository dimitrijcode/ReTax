export type InvoiceItem = {
  description: string;
  net: number;
  vatRate: number;
};

export type ExtractedInvoice = {
  vendor: string;
  date: string;
  invoiceNumber: string;
  net: number;
  vat: number;
  gross: number;
  currency: string;
  items: InvoiceItem[];
  categoryHint?: string;
};

export type InvoiceExtractErrorCode =
  | "MISSING_PDF"
  | "MISSING_API_KEY"
  | "UNUSABLE_RESPONSE";

export class InvoiceExtractError extends Error {
  readonly code: InvoiceExtractErrorCode;

  constructor(code: InvoiceExtractErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InvoiceExtractError";
    this.code = code;
  }
}

/** JSON Schema description used by the MCP tool and the Claude prompt. */
export const INVOICE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "ExtractedInvoice",
  description:
    "Structured invoice extracted from a PDF: vendor, ISO date, invoice number, net/vat/gross, currency, line items, optional category hint.",
  type: "object",
  additionalProperties: false,
  required: ["vendor", "date", "invoiceNumber", "net", "vat", "gross", "currency", "items"],
  properties: {
    vendor: { type: "string", minLength: 1, description: "Seller / merchant name" },
    date: {
      type: "string",
      format: "date",
      description: "Invoice date as ISO 8601 calendar date (YYYY-MM-DD)",
    },
    invoiceNumber: { type: "string", minLength: 1, description: "Invoice / Beleg number" },
    net: { type: "number", description: "Net amount (ex-VAT)" },
    vat: { type: "number", description: "VAT / USt amount" },
    gross: { type: "number", description: "Gross amount (inc-VAT)" },
    currency: { type: "string", minLength: 3, maxLength: 3, description: "ISO 4217 currency, e.g. EUR" },
    items: {
      type: "array",
      description: "Line items on the invoice",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "net", "vatRate"],
        properties: {
          description: { type: "string", minLength: 1 },
          net: { type: "number" },
          vatRate: { type: "number", description: "VAT rate as percent, e.g. 19 for 19%" },
        },
      },
    },
    categoryHint: {
      type: "string",
      description: "Short tax-category hint, e.g. Computerhardware/Notebook",
    },
  },
} as const;

export const INVOICE_TOOL_DESCRIPTION = [
  "Extract structured invoice fields from a PDF (path or base64).",
  INVOICE_JSON_SCHEMA.description,
  "Returns JSON matching INVOICE_JSON_SCHEMA.",
].join(" ");

const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:[Tt ].*)?$/;

function unusable(message: string, cause?: unknown): never {
  throw new InvoiceExtractError("UNUSABLE_RESPONSE", message, cause ? { cause } : undefined);
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    unusable(`Field ${field} must be a non-empty string`);
  }
  return value.trim();
}

function asFiniteNumber(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  unusable(`Field ${field} must be a finite number`);
}

function asIsoDate(value: unknown): string {
  const raw = asNonEmptyString(value, "date");
  const match = ISO_DATE.exec(raw);
  if (!match) {
    unusable("Field date must be an ISO 8601 date (YYYY-MM-DD)");
  }
  const isoDate = match[1];
  const millis = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(millis)) {
    unusable("Field date is not a valid calendar date");
  }
  return isoDate;
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonObject(text: string): string {
  const body = stripJsonFence(text);
  if (body.startsWith("{") && body.endsWith("}")) {
    return body;
  }
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) {
    unusable("Model response did not contain a JSON object");
  }
  return body.slice(start, end + 1);
}

function asItem(value: unknown, index: number): InvoiceItem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    unusable(`items[${index}] must be an object`);
  }
  const row = value as Record<string, unknown>;
  return {
    description: asNonEmptyString(row.description, `items[${index}].description`),
    net: asFiniteNumber(row.net, `items[${index}].net`),
    vatRate: asFiniteNumber(row.vatRate, `items[${index}].vatRate`),
  };
}

/** Parse and validate invoice JSON from a model payload (raw text or already-parsed object). */
export function parseInvoiceJson(payload: string | unknown): ExtractedInvoice {
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    const jsonText = extractJsonObject(payload);
    try {
      parsed = JSON.parse(jsonText) as unknown;
    } catch (cause) {
      unusable("Model response was not valid JSON", cause);
    }
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    unusable("Invoice JSON must be an object");
  }

  const raw = parsed as Record<string, unknown>;
  if (!Array.isArray(raw.items)) {
    unusable("Field items must be an array");
  }

  const invoice: ExtractedInvoice = {
    vendor: asNonEmptyString(raw.vendor, "vendor"),
    date: asIsoDate(raw.date),
    invoiceNumber: asNonEmptyString(raw.invoiceNumber, "invoiceNumber"),
    net: asFiniteNumber(raw.net, "net"),
    vat: asFiniteNumber(raw.vat, "vat"),
    gross: asFiniteNumber(raw.gross, "gross"),
    currency: asNonEmptyString(raw.currency, "currency").toUpperCase(),
    items: raw.items.map(asItem),
  };

  if (raw.categoryHint !== undefined && raw.categoryHint !== null && raw.categoryHint !== "") {
    invoice.categoryHint = asNonEmptyString(raw.categoryHint, "categoryHint");
  }

  if (invoice.currency.length !== 3) {
    unusable("Field currency must be a 3-letter ISO 4217 code");
  }

  return invoice;
}
