import { describe, it, expect } from "vitest";
import { formatNumber, formatPercent, formatCurrency, formatOwnership, UNAVAILABLE } from "../src/lib/format";

describe("null/undefined formatting never leaks raw values", () => {
  it("formatNumber", () => {
    expect(formatNumber(undefined)).toBe(UNAVAILABLE);
    expect(formatNumber(null)).toBe(UNAVAILABLE);
    expect(formatNumber(NaN)).toBe(UNAVAILABLE);
    expect(formatNumber(1234)).toBe("1,234");
  });

  it("formatPercent", () => {
    expect(formatPercent(undefined)).toBe(UNAVAILABLE);
    expect(formatPercent(0.0897)).toBe("9%");
  });

  it("formatCurrency", () => {
    expect(formatCurrency(undefined)).toBe(UNAVAILABLE);
    expect(formatCurrency(15203)).toBe("$15,203");
  });

  it("formatOwnership falls back gracefully for unrecognized/missing values", () => {
    expect(formatOwnership(undefined)).toBe(UNAVAILABLE);
    expect(formatOwnership("public")).toBe("Public");
  });
});
