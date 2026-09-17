import { readFile } from "node:fs/promises";
import { Anthropic } from "@anthropic-ai/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  INVOICE_JSON_SCHEMA,
  INVOICE_TOOL_DESCRIPTION,
  InvoiceExtractError,
  parseInvoiceJson,
  type ExtractedInvoice,
} from "../extract/invoiceJson.js";

export {
  INVOICE_JSON_SCHEMA,
  INVOICE_TOOL_DESCRIPTION,
  InvoiceExtractError,
  parseInvoiceJson,
};
export type { ExtractedInvoice, InvoiceExtractErrorCode, InvoiceItem } from "../extract/invoiceJson.js";

export const INVOICE_EXTRACT_MODEL = "claude-sonnet-4-5";

export type PdfRef = {
  path?: string;
  base64?: string;
};

export type InvoiceLlmClient = {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      messages: Array<{
        role: "user";
        content: Array<
          | {
              type: "document";
              source: { type: "base64"; media_type: "application/pdf"; data: string };
            }
          | { type: "text"; text: string }
        >;
      }>;
      output_config?: {
        format: { type: "json_schema"; schema: Record<string, unknown> };
      };
    }) => Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
};

const EXTRACT_PROMPT = `Extract every field from the attached invoice PDF.
Reply with a single JSON object that matches this schema. No markdown, no commentary.

${JSON.stringify(INVOICE_JSON_SCHEMA, null, 2)}

Rules:
- date must be ISO 8601 YYYY-MM-DD
- net, vat, gross, and item.net / item.vatRate must be JSON numbers (not strings)
- vatRate is a percent (19 means 19%)
- currency is ISO 4217 (EUR, USD, …)
- omit categoryHint if you cannot infer one`;

function anthropicSchema(): Record<string, unknown> {
  const { $schema: _schema, ...rest } = INVOICE_JSON_SCHEMA;
  return rest;
}

async function readPdfBase64(pdfRef: PdfRef): Promise<string> {
  if (pdfRef.base64 && pdfRef.base64.trim() !== "") {
    return pdfRef.base64
      .trim()
      .replace(/^data:application\/pdf;base64,/i, "")
      .replace(/\s/g, "");
  }

  if (pdfRef.path && pdfRef.path.trim() !== "") {
    try {
      const bytes = await readFile(pdfRef.path);
      return bytes.toString("base64");
    } catch (cause) {
      throw new InvoiceExtractError("MISSING_PDF", `Cannot read PDF at ${pdfRef.path}`, { cause });
    }
  }

  throw new InvoiceExtractError("MISSING_PDF", "pdfRef requires path or base64");
}

function defaultClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new InvoiceExtractError("MISSING_API_KEY", "ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}

function textFromMessage(content: Array<{ type: string; text?: string }>): string {
  const text = content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) {
    throw new InvoiceExtractError("UNUSABLE_RESPONSE", "Model returned no text content");
  }
  return text;
}

export async function extractInvoice(
  pdfRef: PdfRef,
  options?: { client?: InvoiceLlmClient },
): Promise<ExtractedInvoice> {
  const pdfBase64 = await readPdfBase64(pdfRef);
  const client = options?.client ?? defaultClient();

  const message = await client.messages.create({
    model: INVOICE_EXTRACT_MODEL,
    max_tokens: 4096,
    output_config: {
      format: {
        type: "json_schema",
        schema: anthropicSchema(),
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          { type: "text", text: EXTRACT_PROMPT },
        ],
      },
    ],
  });

  return parseInvoiceJson(textFromMessage(message.content));
}

export function registerInvoiceTools(server: McpServer): void {
  server.registerTool(
    "invoice_extract",
    {
      title: "Extract invoice from PDF",
      description: INVOICE_TOOL_DESCRIPTION,
      inputSchema: {
        path: z.string().optional().describe("Filesystem path to the invoice PDF"),
        base64: z.string().optional().describe("Base64-encoded PDF bytes"),
      },
    },
    async ({ path, base64 }) => {
      try {
        const invoice = await extractInvoice({ path, base64 });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(invoice) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: message }],
        };
      }
    },
  );
}
