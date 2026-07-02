import { describe, expect, it } from "vitest";
import { currencySymbol, formatCost, formatTokens } from "../src/core/format";

describe("format helpers", () => {
  it("formats token counts with thousands separators", () => {
    expect(formatTokens(1234)).toBe("1,234");
    expect(formatTokens(1234.4)).toBe("1,234");
    expect(formatTokens(1234.5)).toBe("1,235");
  });

  it("returns symbols for additional supported currencies", () => {
    expect(currencySymbol("CHF")).toBe("CHF");
    expect(currencySymbol("SEK")).toBe("kr");
    expect(currencySymbol("AED")).toBe("د.إ");
    expect(currencySymbol("PKR")).toBe("₨");
    expect(currencySymbol("ZAR")).toBe("R");
    expect(currencySymbol("MXN")).toBe("MX$");
  });

  it("normalizes currency codes before looking up symbols", () => {
    expect(currencySymbol("chf")).toBe("CHF");
    expect(formatCost(1.25, "mxn")).toBe("MX$1.25");
  });

  it("falls back to the currency code for unknown currencies", () => {
    expect(currencySymbol("XYZ")).toBe("");
    expect(formatCost(1.25, "XYZ")).toBe("XYZ 1.25");
  });

  it("keeps extra precision for sub-cent costs", () => {
    expect(formatCost(0.000123, "AED")).toBe("د.إ0.000123");
    expect(formatCost(0.0123, "PKR")).toBe("₨0.0123");
  });
});
