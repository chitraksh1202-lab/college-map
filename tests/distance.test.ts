import { describe, it, expect } from "vitest";
import { haversineMiles, formatMiles } from "../src/lib/distance";

describe("haversineMiles", () => {
  it("returns 0 for the same point", () => {
    const p = { latitude: 34.0689, longitude: -118.4452 };
    expect(haversineMiles(p, p)).toBeCloseTo(0, 5);
  });

  it("computes a known great-circle distance (LA to NYC, ~2445 mi)", () => {
    const la = { latitude: 34.0522, longitude: -118.2437 };
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const miles = haversineMiles(la, nyc);
    expect(miles).toBeGreaterThan(2400);
    expect(miles).toBeLessThan(2500);
  });

  it("is symmetric", () => {
    const a = { latitude: 34.0689, longitude: -118.4452 };
    const b = { latitude: 37.8719, longitude: -122.2585 };
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 8);
  });
});

describe("formatMiles", () => {
  it("rounds to the nearest mile", () => {
    expect(formatMiles(12.4)).toBe("12 mi");
    expect(formatMiles(12.6)).toBe("13 mi");
  });
  it("special-cases sub-mile distances", () => {
    expect(formatMiles(0.3)).toBe("under 1 mi");
  });
});
