import {
  availableMethods,
  classifyAsset,
  isGwgEligible,
  ownershipFromShare,
} from "./classify";
import { buildJournal } from "./journal";
import { fromCents, shareCents, toCents } from "./money";
import {
  GWG_LIMIT_NET,
  type AlternativePlan,
  type DepreciationMethod,
  type Invoice,
  type TaxPlan,
  type TaxYearLine,
} from "./types";

export class GwgIneligibleError extends Error {
  readonly code = "GWG_INELIGIBLE" as const;

  constructor(net: number) {
    super(
      `GWG nicht zulässig: Netto ${net} € übersteigt ${GWG_LIMIT_NET} €.`,
    );
    this.name = "GwgIneligibleError";
  }
}

const USEFUL_LIFE_MONTHS: Record<DepreciationMethod, number> = {
  gwg: 0,
  one_year: 12,
  three_year_linear: 36,
};

export function parseIsoDate(iso: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    throw new Error(`Ungültiges Rechnungsdatum: ${iso}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Ungültiger Monat im Rechnungsdatum: ${iso}`);
  }
  return { year, month };
}

/** Months of AfA in the acquisition year, § 7 Abs. 1 S. 4 EStG (month of purchase counts). */
export function monthsInAcquisitionYear(month: number): number {
  return 13 - month;
}

function monthBuckets(startMonth: number, totalMonths: number): number[] {
  const buckets: number[] = [];
  let left = totalMonths;
  const first = Math.min(monthsInAcquisitionYear(startMonth), left);
  buckets.push(first);
  left -= first;
  while (left > 0) {
    const chunk = Math.min(12, left);
    buckets.push(chunk);
    left -= chunk;
  }
  return buckets;
}

function allocateCents(netCents: number, months: number[]): number[] {
  const totalMonths = months.reduce((sum, value) => sum + value, 0);
  const amounts: number[] = [];
  let used = 0;
  for (let i = 0; i < months.length; i += 1) {
    if (i === months.length - 1) {
      amounts.push(netCents - used);
    } else {
      const amount = Math.round((netCents * months[i]!) / totalMonths);
      amounts.push(amount);
      used += amount;
    }
  }
  return amounts;
}

function buildYearLines(
  invoice: Invoice,
  method: DepreciationMethod,
  businessSharePct: number,
  assignedToBusiness: boolean,
): TaxYearLine[] {
  const netCents = toCents(invoice.net);
  const { year: startYear, month } = parseIsoDate(invoice.date);

  if (method === "gwg") {
    const afa = fromCents(netCents);
    const businessDeductible = assignedToBusiness
      ? fromCents(shareCents(netCents, businessSharePct))
      : 0;
    return [
      {
        year: startYear,
        afa,
        businessDeductible,
        remainingBookValue: 0,
      },
    ];
  }

  const totalMonths = USEFUL_LIFE_MONTHS[method];
  const buckets = monthBuckets(month, totalMonths);
  const amounts = allocateCents(netCents, buckets);

  let remaining = netCents;
  return amounts.map((afaCents, index) => {
    remaining -= afaCents;
    return {
      year: startYear + index,
      afa: fromCents(afaCents),
      businessDeductible: assignedToBusiness
        ? fromCents(shareCents(afaCents, businessSharePct))
        : 0,
      remainingBookValue: fromCents(remaining),
    };
  });
}

function alternativeFrom(
  invoice: Invoice,
  method: DepreciationMethod,
  businessSharePct: number,
  assignedToBusiness: boolean,
): AlternativePlan {
  const years = buildYearLines(
    invoice,
    method,
    businessSharePct,
    assignedToBusiness,
  );
  return {
    method,
    years,
    deductibleNow: years[0]?.businessDeductible ?? 0,
  };
}

export function computePlan(
  invoice: Invoice,
  businessSharePct: number,
  method?: DepreciationMethod,
): TaxPlan {
  if (businessSharePct < 0 || businessSharePct > 100) {
    throw new RangeError("businessSharePct muss zwischen 0 und 100 liegen.");
  }

  const { category, label } = classifyAsset(invoice);
  const ownership = ownershipFromShare(businessSharePct);
  const assignedToBusiness = ownership !== "private";
  const availability = availableMethods(invoice, category);
  const chosen = method ?? availability.recommended;

  if (chosen === "gwg" && !isGwgEligible(invoice)) {
    throw new GwgIneligibleError(invoice.net);
  }

  const years = buildYearLines(
    invoice,
    chosen,
    businessSharePct,
    assignedToBusiness,
  );
  const vatInputDeductible = assignedToBusiness
    ? fromCents(shareCents(toCents(invoice.vat), businessSharePct))
    : 0;
  const alternatives = availability.methods
    .filter((candidate) => candidate !== chosen)
    .map((candidate) =>
      alternativeFrom(invoice, candidate, businessSharePct, assignedToBusiness),
    );

  const planWithoutJournal: Omit<TaxPlan, "journal"> = {
    method: chosen,
    recommendedMethod: availability.recommended,
    ownership,
    assignedToBusiness,
    businessSharePct,
    category,
    categoryLabel: label,
    years,
    deductibleNow: years[0]?.businessDeductible ?? 0,
    vatInputDeductible,
    alternatives,
  };

  return {
    ...planWithoutJournal,
    journal: buildJournal(invoice, planWithoutJournal),
  };
}
