import { describe, it, expect } from "vitest";
import { getAllColleges, getCollegesByState, getNearbyColleges } from "../src/lib/colleges";

const colleges = getAllColleges();

describe("generated dataset integrity", () => {
  it("is a national-scale dataset, not empty or suspiciously small", () => {
    expect(colleges.length).toBeGreaterThan(500);
  });

  it("has unique UNITIDs", () => {
    const ids = colleges.map((c) => c.unitId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique slugs", () => {
    const slugs = colleges.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has no invalid coordinates", () => {
    for (const c of colleges) {
      expect(c.latitude).toBeGreaterThanOrEqual(-90);
      expect(c.latitude).toBeLessThanOrEqual(90);
      expect(c.longitude).toBeGreaterThanOrEqual(-180);
      expect(c.longitude).toBeLessThanOrEqual(180);
      expect(Number.isNaN(c.latitude)).toBe(false);
      expect(Number.isNaN(c.longitude)).toBe(false);
    }
  });

  it("has no impossible admission rates", () => {
    for (const c of colleges) {
      if (c.admissionRate !== undefined) {
        expect(c.admissionRate).toBeGreaterThanOrEqual(0);
        expect(c.admissionRate).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("getCollegesByState", () => {
  it("groups colleges by state code correctly", () => {
    const ca = getCollegesByState("CA");
    expect(ca.length).toBeGreaterThan(0);
    expect(ca.every((c) => c.stateCode === "CA")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(getCollegesByState("ca").length).toBe(getCollegesByState("CA").length);
  });
});

describe("getNearbyColleges", () => {
  it("never includes the origin institution itself", () => {
    const nearby = getNearbyColleges("university-of-california-los-angeles", 6);
    expect(nearby.some((n) => n.college.slug === "university-of-california-los-angeles")).toBe(false);
  });

  it("returns results sorted by increasing distance", () => {
    const nearby = getNearbyColleges("harvard-university", 6);
    const distances = nearby.map((n) => n.distanceMiles);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("returns an empty array for an unknown slug", () => {
    expect(getNearbyColleges("not-a-real-college")).toEqual([]);
  });
});
