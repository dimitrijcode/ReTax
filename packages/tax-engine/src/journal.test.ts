import { describe, expect, it } from "vitest";
import { computePlan } from "./depreciation";
import { SKR03 } from "./journal";
import { toCents } from "./money";
import type { Invoice, JournalEntry } from "./types";

function laptop(overrides: Partial<Invoice> = {}): Invoice {
  return {
    vendor: "MediaMarkt",
    date: "2024-01-12",
    invoiceNumber: "RE-42",
    net: 1000,
    vat: 190,
    gross: 1190,
    currency: "EUR",
    items: [{ description: "Notebook", net: 1000, vatRate: 0.19 }],
    ...overrides,
  };
}

function totals(entry: JournalEntry): { debit: number; credit: number } {
  return {
    debit: entry.lines.reduce((sum, line) => sum + toCents(line.debit), 0),
    credit: entry.lines.reduce((sum, line) => sum + toCents(line.credit), 0),
  };
}

describe("buildJournal SKR03", () => {
  it("books acquisition 0420 + 1576 to 1200, AfA 4830 to 0420, private use 1800 to 8910", () => {
    const plan = computePlan(laptop(), 50, "one_year");
    const [acquisition, afa, privateUse] = plan.journal;

    expect(acquisition?.memo).toContain("Anschaffung");
    expect(acquisition?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account: SKR03.assetOffice.account, debit: 1000, credit: 0 }),
        expect.objectContaining({ account: SKR03.vatInput19.account, debit: 95, credit: 0 }),
        expect.objectContaining({ account: SKR03.drawings.account, debit: 95, credit: 0 }),
        expect.objectContaining({ account: SKR03.bank.account, debit: 0, credit: 1190 }),
      ]),
    );

    expect(afa?.lines).toEqual([
      expect.objectContaining({ account: SKR03.afaTangible.account, debit: 1000, credit: 0 }),
      expect.objectContaining({ account: SKR03.assetOffice.account, debit: 0, credit: 1000 }),
    ]);

    expect(privateUse?.lines).toEqual([
      expect.objectContaining({ account: SKR03.drawings.account, debit: 500, credit: 0 }),
      expect.objectContaining({ account: SKR03.privateUse.account, debit: 0, credit: 500 }),
    ]);

    for (const entry of plan.journal) {
      const { debit, credit } = totals(entry);
      expect(debit).toBe(credit);
    }
  });

  it("uses 0480 and 4855 for GWG", () => {
    const plan = computePlan(
      laptop({ net: 800, vat: 152, gross: 952, items: [{ description: "Laptop", net: 800, vatRate: 0.19 }] }),
      100,
      "gwg",
    );
    const accounts = plan.journal.flatMap((entry) => entry.lines.map((line) => line.account));
    expect(accounts).toContain("0480");
    expect(accounts).toContain("4855");
    expect(accounts).not.toContain("0420");
    expect(accounts).not.toContain("4830");
  });
});
