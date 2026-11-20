import { describe, it, expect } from "vitest";
import { searchColleges, getDisplayName } from "../src/lib/search";
import { getAllColleges } from "../src/lib/colleges";

const colleges = getAllColleges();

function topSlug(query: string): string | undefined {
  return searchColleges(colleges, query, 5)[0]?.slug;
}

describe("searchColleges ranking against the real national dataset", () => {
  it("ucla -> UCLA (via alias)", () => {
    expect(topSlug("ucla")).toBe("university-of-california-los-angeles");
  });
  it("berkeley -> UC Berkeley (via alias)", () => {
    expect(topSlug("berkeley")).toBe("university-of-california-berkeley");
  });
  it("mit -> MIT (via alias)", () => {
    expect(topSlug("mit")).toBe("massachusetts-institute-of-technology");
  });
  it("usc -> University of Southern California (deliberate, documented alias choice)", () => {
    expect(topSlug("usc")).toBe("university-of-southern-california");
  });
  it("georgia tech -> Georgia Institute of Technology", () => {
    expect(topSlug("georgia tech")).toBe("georgia-institute-of-technology");
  });
  it("stanford -> Stanford University", () => {
    expect(topSlug("stanford")).toBe("stanford-university");
  });
  it("harvard -> Harvard University", () => {
    expect(topSlug("harvard")).toBe("harvard-university");
  });

  it("'University of Florida' does not resolve to Baptist University of Florida or an online variant", () => {
    const results = searchColleges(colleges, "University of Florida", 5).map((c) => c.slug);
    expect(results[0]).toBe("university-of-florida");
    expect(results[0]).not.toBe("baptist-university-of-florida");
  });

  it("empty query returns no results", () => {
    expect(searchColleges(colleges, "")).toHaveLength(0);
    expect(searchColleges(colleges, "   ")).toHaveLength(0);
  });

  it("respects the limit parameter", () => {
    expect(searchColleges(colleges, "university", 3)).toHaveLength(3);
  });

  it("'university of oxford' -> University of Oxford (global/ROR institution, exact name match)", () => {
    expect(topSlug("university of oxford")).toBe("university-of-oxford");
  });
  it("eth zurich -> ETH Zurich (global institution, unambiguous name match)", () => {
    expect(topSlug("eth zurich")).toBe("eth-zurich");
  });
  it("'national university of singapore' -> NUS by exact name, not by ambiguous bare acronym", () => {
    expect(topSlug("national university of singapore")).toBe("national-university-of-singapore");
  });
  it("'university of toronto' -> University of Toronto (exact name, not the many other Toronto-named institutions)", () => {
    expect(topSlug("university of toronto")).toBe("university-of-toronto");
  });

  it(
    "known limitation: a bare acronym shared by multiple global institutions (e.g. 'nus') resolves " +
      "deterministically (alphabetically among the tied exact-alias matches) rather than crashing or " +
      "being random — un-curated global aliases can collide, unlike the hand-checked US alias list",
    () => {
      const results = searchColleges(colleges, "nus", 10);
      expect(results.length).toBeGreaterThan(0);
      // Every top-tier result really does have "nus" as an exact alias/acronym.
      for (const r of results.slice(0, 3)) {
        expect(r.aliases ?? []).toContain("nus");
      }
      // Deterministic: re-running the identical search yields the identical order.
      expect(searchColleges(colleges, "nus", 10).map((r) => r.slug)).toEqual(results.map((r) => r.slug));
    }
  );
});

describe("getDisplayName", () => {
  it("uses the curated display name when one exists", () => {
    const ucla = colleges.find((c) => c.slug === "university-of-california-los-angeles")!;
    expect(getDisplayName(ucla)).toBe("UCLA");
  });
  it("falls back to the official name otherwise", () => {
    const stanford = colleges.find((c) => c.slug === "stanford-university")!;
    expect(getDisplayName(stanford)).toBe(stanford.name);
  });
});
