import { describe, expect, it } from "vitest";
import {
  availableMethods,
  classifyAsset,
  ownershipFromShare,
} from "./classify";
import { GWG_LIMIT_NET, type Invoice } from "./types";

function laptopInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    vendor: "MediaMarkt",
    date: "2024-07-15",
    invoiceNumber: "RE-2024-001",
    net: 1000,
    vat: 190,
    gross: 1190,
    currency: "EUR",
    items: [{ description: "Lenovo ThinkPad X1", net: 1000, vatRate: 0.19 }],
    categoryHint: "Computerhardware/Notebook",
    ...overrides,
  };
}

describe("classifyAsset", () => {
  it("maps notebooks, laptops and computers to computer_hardware", () => {
    expect(classifyAsset(laptopInvoice()).category).toBe("computer_hardware");
    expect(classifyAsset(laptopInvoice()).label).toBe("Computerhardware/Notebook");
    expect(
      classifyAsset(
        laptopInvoice({
          categoryHint: undefined,
          items: [{ description: "Apple MacBook Pro 14", net: 1000, vatRate: 0.19 }],
        }),
      ).category,
    ).toBe("computer_hardware");
    expect(
      classifyAsset(
        laptopInvoice({
          vendor: "Office Depot",
          categoryHint: undefined,
          items: [{ description: "Bürostuhl Mesh", net: 200, vatRate: 0.19 }],
        }),
      ).category,
    ).toBe("other");
  });
});

describe("ownershipFromShare", () => {
  it("uses 10 % and 50 % thresholds", () => {
    expect(ownershipFromShare(0)).toBe("private");
    expect(ownershipFromShare(9.99)).toBe("private");
    expect(ownershipFromShare(10)).toBe("optional_business");
    expect(ownershipFromShare(50)).toBe("optional_business");
    expect(ownershipFromShare(50.01)).toBe("necessary_business");
    expect(ownershipFromShare(100)).toBe("necessary_business");
  });
});

describe("availableMethods", () => {
  it("offers GWG only when net ≤ 800 and recommends it", () => {
    const gwgInvoice = laptopInvoice({ net: GWG_LIMIT_NET, vat: 152, gross: 952 });
    const available = availableMethods(gwgInvoice, "computer_hardware");
    expect(available.gwgEligible).toBe(true);
    expect(available.methods).toEqual(["gwg", "one_year", "three_year_linear"]);
    expect(available.recommended).toBe("gwg");
  });

  it("recommends one_year for computer_hardware above the GWG limit", () => {
    const available = availableMethods(laptopInvoice({ net: 801 }), "computer_hardware");
    expect(available.gwgEligible).toBe(false);
    expect(available.methods).toEqual(["one_year", "three_year_linear"]);
    expect(available.recommended).toBe("one_year");
  });
});
