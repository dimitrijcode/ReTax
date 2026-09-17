import { describe, expect, it } from "vitest";
import {
  computePlan,
  GwgIneligibleError,
  monthsInAcquisitionYear,
} from "./depreciation";
import { GWG_LIMIT_NET, type Invoice } from "./types";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    vendor: "MediaMarkt",
    date: "2024-07-15",
    invoiceNumber: "RE-2024-001",
    net: 1200,
    vat: 228,
    gross: 1428,
    currency: "EUR",
    items: [{ description: "Laptop", net: 1200, vatRate: 0.19 }],
    categoryHint: "notebook",
    ...overrides,
  };
}

describe("monthsInAcquisitionYear", () => {
  it("counts the acquisition month (July = 6/12)", () => {
    expect(monthsInAcquisitionYear(1)).toBe(12);
    expect(monthsInAcquisitionYear(7)).toBe(6);
    expect(monthsInAcquisitionYear(12)).toBe(1);
  });
});

describe("computePlan", () => {
  it("treats a 50 % laptop above 800 € as optional BV and recommends one_year", () => {
    const plan = computePlan(invoice({ date: "2024-01-10", net: 1200 }), 50);
    expect(plan.ownership).toBe("optional_business");
    expect(plan.assignedToBusiness).toBe(true);
    expect(plan.category).toBe("computer_hardware");
    expect(plan.recommendedMethod).toBe("one_year");
    expect(plan.method).toBe("one_year");
    expect(plan.years).toEqual([
      { year: 2024, afa: 1200, businessDeductible: 600, remainingBookValue: 0 },
    ]);
    expect(plan.deductibleNow).toBe(600);
    expect(plan.vatInputDeductible).toBe(114);
    expect(plan.alternatives.map((item) => item.method)).toEqual(["three_year_linear"]);
  });

  it("compares one_year vs three_year_linear for a 50 % laptop > 800 €", () => {
    const base = invoice({ date: "2024-01-10", net: 1200, vat: 228, gross: 1428 });
    const oneYear = computePlan(base, 50, "one_year");
    const threeYear = computePlan(base, 50, "three_year_linear");

    expect(oneYear.years).toHaveLength(1);
    expect(oneYear.years[0]).toMatchObject({
      afa: 1200,
      businessDeductible: 600,
      remainingBookValue: 0,
    });

    expect(threeYear.years).toEqual([
      { year: 2024, afa: 400, businessDeductible: 200, remainingBookValue: 800 },
      { year: 2025, afa: 400, businessDeductible: 200, remainingBookValue: 400 },
      { year: 2026, afa: 400, businessDeductible: 200, remainingBookValue: 0 },
    ]);
    expect(threeYear.deductibleNow).toBe(200);
    expect(oneYear.deductibleNow).toBeGreaterThan(threeYear.deductibleNow);
  });

  it("applies monthly pro rata: July acquisition is 6/12 in the first year", () => {
    const july = invoice({ date: "2024-07-15", net: 1200 });
    const oneYear = computePlan(july, 50, "one_year");
    expect(oneYear.years).toEqual([
      { year: 2024, afa: 600, businessDeductible: 300, remainingBookValue: 600 },
      { year: 2025, afa: 600, businessDeductible: 300, remainingBookValue: 0 },
    ]);

    const threeYear = computePlan(july, 50, "three_year_linear");
    expect(threeYear.years).toEqual([
      { year: 2024, afa: 200, businessDeductible: 100, remainingBookValue: 1000 },
      { year: 2025, afa: 400, businessDeductible: 200, remainingBookValue: 600 },
      { year: 2026, afa: 400, businessDeductible: 200, remainingBookValue: 200 },
      { year: 2027, afa: 200, businessDeductible: 100, remainingBookValue: 0 },
    ]);
  });

  it("posts full GWG in the acquisition year when net ≤ 800", () => {
    const gwgInvoice = invoice({
      date: "2024-07-01",
      net: GWG_LIMIT_NET,
      vat: 152,
      gross: 952,
      items: [{ description: "Laptop", net: GWG_LIMIT_NET, vatRate: 0.19 }],
    });
    const plan = computePlan(gwgInvoice, 100);
    expect(plan.method).toBe("gwg");
    expect(plan.recommendedMethod).toBe("gwg");
    expect(plan.years).toEqual([
      { year: 2024, afa: 800, businessDeductible: 800, remainingBookValue: 0 },
    ]);
    expect(plan.deductibleNow).toBe(800);
    expect(plan.journal.some((entry) => entry.lines.some((line) => line.account === "0480"))).toBe(
      true,
    );
    expect(plan.journal.some((entry) => entry.lines.some((line) => line.account === "4855"))).toBe(
      true,
    );
  });

  it("rejects GWG when net exceeds 800 €", () => {
    expect(() => computePlan(invoice({ net: 801, vat: 152.19, gross: 953.19 }), 100, "gwg")).toThrow(
      GwgIneligibleError,
    );
  });

  it("allows no deduction below 10 % business use", () => {
    const plan = computePlan(invoice(), 9);
    expect(plan.ownership).toBe("private");
    expect(plan.assignedToBusiness).toBe(false);
    expect(plan.deductibleNow).toBe(0);
    expect(plan.vatInputDeductible).toBe(0);
    expect(plan.years.every((line) => line.businessDeductible === 0)).toBe(true);
    expect(plan.years.some((line) => line.afa > 0)).toBe(true);
    expect(plan.journal).toEqual([]);
  });
});
