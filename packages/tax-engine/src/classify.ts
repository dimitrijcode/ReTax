import { toCents } from "./money";
import {
  GWG_LIMIT_NET,
  NECESSARY_BUSINESS_MIN_PCT,
  OPTIONAL_BUSINESS_MIN_PCT,
  type AssetClass,
  type Classification,
  type DepreciationMethod,
  type Invoice,
  type MethodAvailability,
  type OwnershipKind,
} from "./types";

const COMPUTER_RE =
  /notebook|laptop|macbook|imac|thinkpad|chromebook|ultrabook|computer|desktop|\bpc\b|workstation/i;

export function classifyAsset(invoice: Invoice): Classification {
  const haystack = [
    invoice.categoryHint ?? "",
    invoice.vendor,
    ...invoice.items.map((item) => item.description),
  ].join(" ");

  if (COMPUTER_RE.test(haystack)) {
    return { category: "computer_hardware", label: "Computerhardware/Notebook" };
  }

  return {
    category: "other",
    label: invoice.categoryHint?.trim() || "Sonstiges Wirtschaftsgut",
  };
}

export function ownershipFromShare(businessSharePct: number): OwnershipKind {
  if (businessSharePct < OPTIONAL_BUSINESS_MIN_PCT) return "private";
  if (businessSharePct <= NECESSARY_BUSINESS_MIN_PCT) return "optional_business";
  return "necessary_business";
}

export function isGwgEligible(invoice: Invoice): boolean {
  return toCents(invoice.net) <= toCents(GWG_LIMIT_NET);
}

export function availableMethods(
  invoice: Invoice,
  category: AssetClass,
): MethodAvailability {
  const gwgEligible = isGwgEligible(invoice);
  const methods: DepreciationMethod[] = [];

  if (gwgEligible) methods.push("gwg");
  if (category === "computer_hardware") methods.push("one_year");
  methods.push("three_year_linear");

  const recommended: DepreciationMethod = gwgEligible
    ? "gwg"
    : category === "computer_hardware"
      ? "one_year"
      : "three_year_linear";

  return { methods, recommended, gwgEligible };
}
