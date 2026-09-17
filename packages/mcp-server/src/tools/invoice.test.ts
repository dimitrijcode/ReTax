import { describe, expect, it, vi } from "vitest";
import {
  extractInvoice,
  INVOICE_EXTRACT_MODEL,
  INVOICE_JSON_SCHEMA,
  InvoiceExtractError,
  parseInvoiceJson,
  type InvoiceLlmClient,
} from "./invoice.js";

const FAKE_INVOICE = {
  vendor: "Apple Retail Germany B.V. & Co. KG",
  date: "2026-09-12",
  invoiceNumber: "INV-1001",
  net: 1259.66,
  vat: 239.34,
  gross: 1499,
  currency: "EUR",
  items: [{ description: "MacBook Air 13\"", net: 1259.66, vatRate: 19 }],
  categoryHint: "Computerhardware/Notebook",
};

function mockClient(text: string): InvoiceLlmClient & { create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async () => ({
    content: [{ type: "text", text }],
  }));
  return {
    create,
    messages: { create },
  };
}

describe("INVOICE_JSON_SCHEMA", () => {
  it("describes the fields the tool extracts", () => {
    expect(INVOICE_JSON_SCHEMA.required).toEqual([
      "vendor",
      "date",
      "invoiceNumber",
      "net",
      "vat",
      "gross",
      "currency",
      "items",
    ]);
    expect(INVOICE_JSON_SCHEMA.properties.items.items.required).toEqual([
      "description",
      "net",
      "vatRate",
    ]);
  });
});

describe("parseInvoiceJson", () => {
  it("parses a fake model JSON payload", () => {
    const invoice = parseInvoiceJson(JSON.stringify(FAKE_INVOICE));
    expect(invoice).toEqual(FAKE_INVOICE);
  });

  it("parses JSON wrapped in markdown fences", () => {
    const invoice = parseInvoiceJson("```json\n" + JSON.stringify(FAKE_INVOICE) + "\n```");
    expect(invoice.invoiceNumber).toBe("INV-1001");
    expect(invoice.items[0]?.vatRate).toBe(19);
  });

  it("coerces numeric strings and normalizes ISO datetimes", () => {
    const invoice = parseInvoiceJson({
      ...FAKE_INVOICE,
      net: "1259.66",
      date: "2026-09-12T14:30:00.000Z",
      currency: "eur",
    });
    expect(invoice.net).toBe(1259.66);
    expect(invoice.date).toBe("2026-09-12");
    expect(invoice.currency).toBe("EUR");
  });

  it("throws a typed error when numbers are unusable", () => {
    expect(() => parseInvoiceJson({ ...FAKE_INVOICE, gross: "not-a-number" })).toThrow(
      InvoiceExtractError,
    );
    try {
      parseInvoiceJson({ ...FAKE_INVOICE, vat: Number.NaN });
    } catch (err) {
      expect(err).toBeInstanceOf(InvoiceExtractError);
      expect((err as InvoiceExtractError).code).toBe("UNUSABLE_RESPONSE");
    }
  });
});

describe("extractInvoice", () => {
  it("sends the PDF as a Claude document block and parses the mocked payload", async () => {
    const client = mockClient(JSON.stringify(FAKE_INVOICE));
    const invoice = await extractInvoice({ base64: "JVBERi0xLjQK" }, { client });

    expect(invoice.vendor).toBe(FAKE_INVOICE.vendor);
    expect(invoice.gross).toBe(1499);
    expect(client.create).toHaveBeenCalledOnce();

    const params = client.create.mock.calls[0]?.[0] as {
      model: string;
      messages: Array<{
        content: Array<{
          type: string;
          source?: { type: string; media_type: string; data: string };
        }>;
      }>;
    };
    expect(params.model).toBe(INVOICE_EXTRACT_MODEL);
    expect(params.messages[0]?.content[0]).toEqual({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: "JVBERi0xLjQK",
      },
    });
  });

  it("throws when pdfRef has neither path nor base64", async () => {
    await expect(extractInvoice({})).rejects.toMatchObject({
      name: "InvoiceExtractError",
      code: "MISSING_PDF",
    });
  });

  it("throws a typed error when the mocked model JSON is unusable", async () => {
    const client = mockClient("sorry, I cannot read this");
    await expect(extractInvoice({ base64: "AAAA" }, { client })).rejects.toBeInstanceOf(
      InvoiceExtractError,
    );
  });
});
