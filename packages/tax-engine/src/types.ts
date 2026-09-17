export type Invoice = {
  vendor: string;
  date: string;
  invoiceNumber: string;
  net: number;
  vat: number;
  gross: number;
  currency: string;
  items: Array<{ description: string; net: number; vatRate: number }>;
  categoryHint?: string;
};

export type DepreciationMethod = "gwg" | "one_year" | "three_year_linear";
export type AssetClass = "computer_hardware" | "other";
export type OwnershipKind = "private" | "optional_business" | "necessary_business";

/** § 6 Abs. 2 EStG Sofortabschreibung, Netto-Grenze. */
export const GWG_LIMIT_NET = 800;

/** Unterhalb 10 %: Privatvermögen, kein Betriebsausgabenabzug. */
export const OPTIONAL_BUSINESS_MIN_PCT = 10;

/** Über 50 %: notwendiges Betriebsvermögen. 10–50 %: gewillkürtes BV. */
export const NECESSARY_BUSINESS_MIN_PCT = 50;

export type Classification = {
  category: AssetClass;
  label: string;
};

export type MethodAvailability = {
  methods: DepreciationMethod[];
  recommended: DepreciationMethod;
  gwgEligible: boolean;
};

export type TaxYearLine = {
  year: number;
  afa: number;
  businessDeductible: number;
  remainingBookValue: number;
};

export type AlternativePlan = {
  method: DepreciationMethod;
  years: TaxYearLine[];
  deductibleNow: number;
};

export type JournalLine = {
  account: string;
  name: string;
  debit: number;
  credit: number;
};

export type JournalEntry = {
  date: string;
  memo: string;
  year: number;
  lines: JournalLine[];
};

export type TaxPlan = {
  method: DepreciationMethod;
  recommendedMethod: DepreciationMethod;
  ownership: OwnershipKind;
  assignedToBusiness: boolean;
  businessSharePct: number;
  category: AssetClass;
  categoryLabel: string;
  years: TaxYearLine[];
  /** First-year business share of AfA (acquisition year). */
  deductibleNow: number;
  /** Input VAT × business share (simplified). */
  vatInputDeductible: number;
  alternatives: AlternativePlan[];
  journal: JournalEntry[];
};
