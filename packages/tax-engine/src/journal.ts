import { fromCents, shareCents, toCents } from "./money";
import type {
  DepreciationMethod,
  Invoice,
  JournalEntry,
  JournalLine,
  TaxPlan,
} from "./types";

export const SKR03 = {
  assetOffice: { account: "0420", name: "Büroeinrichtung" },
  assetGwg: { account: "0480", name: "GWG" },
  vatInput19: { account: "1576", name: "Abziehbare Vorsteuer 19 %" },
  vatInput7: { account: "1571", name: "Abziehbare Vorsteuer 7 %" },
  bank: { account: "1200", name: "Bank" },
  afaTangible: { account: "4830", name: "Abschreibungen auf Sachanlagen" },
  afaGwg: { account: "4855", name: "Sofortabschreibung geringwertiger Wirtschaftsgüter" },
  drawings: { account: "1800", name: "Privatentnahmen allgemein" },
  privateUse: { account: "8910", name: "Entnahme von Gegenständen und sonstigen Leistungen" },
} as const;

type Account = { account: string; name: string };

function assetAccount(method: DepreciationMethod): Account {
  return method === "gwg" ? SKR03.assetGwg : SKR03.assetOffice;
}

function afaAccount(method: DepreciationMethod): Account {
  return method === "gwg" ? SKR03.afaGwg : SKR03.afaTangible;
}

function vatInputAccount(vatRate: number): Account {
  return Math.abs(vatRate - 0.07) < 0.001 ? SKR03.vatInput7 : SKR03.vatInput19;
}

function inferVatRate(invoice: Invoice): number {
  if (invoice.net === 0) return 0;
  return invoice.vat / invoice.net;
}

function line(account: Account, debit: number, credit: number): JournalLine {
  return {
    account: account.account,
    name: account.name,
    debit: fromCents(debit),
    credit: fromCents(credit),
  };
}

export function buildJournal(
  invoice: Invoice,
  plan: Omit<TaxPlan, "journal">,
): JournalEntry[] {
  if (!plan.assignedToBusiness) return [];

  const entries: JournalEntry[] = [];
  const asset = assetAccount(plan.method);
  const expense = afaAccount(plan.method);
  const vatRate = inferVatRate(invoice);
  const vatInput = vatInputAccount(vatRate);

  const netCents = toCents(invoice.net);
  const vatCents = toCents(invoice.vat);
  const deductibleVat = shareCents(vatCents, plan.businessSharePct);
  const privateVat = vatCents - deductibleVat;
  const acquisitionLines: JournalLine[] = [line(asset, netCents, 0)];
  if (deductibleVat > 0) acquisitionLines.push(line(vatInput, deductibleVat, 0));
  if (privateVat > 0) acquisitionLines.push(line(SKR03.drawings, privateVat, 0));
  acquisitionLines.push(line(SKR03.bank, 0, netCents + vatCents));

  entries.push({
    date: invoice.date,
    year: plan.years[0]?.year ?? Number(invoice.date.slice(0, 4)),
    memo: `Anschaffung ${invoice.invoiceNumber}`,
    lines: acquisitionLines,
  });

  const privatePct = 100 - plan.businessSharePct;

  for (const yearLine of plan.years) {
    const afaCents = toCents(yearLine.afa);
    if (afaCents === 0) continue;

    entries.push({
      date: `${yearLine.year}-12-31`,
      year: yearLine.year,
      memo: plan.method === "gwg"
        ? `Sofortabschreibung GWG ${yearLine.year}`
        : `AfA ${yearLine.year}`,
      lines: [
        line(expense, afaCents, 0),
        line(asset, 0, afaCents),
      ],
    });

    if (privatePct > 0) {
      const privateAfa = shareCents(afaCents, privatePct);
      if (privateAfa > 0) {
        entries.push({
          date: `${yearLine.year}-12-31`,
          year: yearLine.year,
          memo: `Private Nutzungsentnahme ${yearLine.year}`,
          lines: [
            line(SKR03.drawings, privateAfa, 0),
            line(SKR03.privateUse, 0, privateAfa),
          ],
        });
      }
    }
  }

  return entries;
}
