import { describe, it, expect } from "vitest";
import { getAllColleges, getNearbyColleges } from "../src/lib/colleges";
import { searchColleges, getDisplayName } from "../src/lib/search";

const colleges = getAllColleges();

/**
 * Phase 17 real-data regression table. If any of these ever fails, a slug
 * moved unexpectedly — the whole point of this architecture is that it
 * shouldn't.
 */
const EXPECTED = [
  { unitId: "110662", slug: "university-of-california-los-angeles", displayName: "UCLA" },
  { unitId: "243744", slug: "stanford-university", displayName: "Stanford University" },
  { unitId: "166683", slug: "massachusetts-institute-of-technology", displayName: "Massachusetts Institute of Technology" },
  { unitId: "166027", slug: "harvard-university", displayName: "Harvard University" },
  { unitId: "110635", slug: "university-of-california-berkeley", displayName: "UC Berkeley" },
  { unitId: "123961", slug: "university-of-southern-california", displayName: "University of Southern California" },
  { unitId: "139755", slug: "georgia-institute-of-technology", displayName: "Georgia Institute of Technology" },
  { unitId: "134130", slug: "university-of-florida", displayName: "University of Florida" },
  { unitId: "204796", slug: "ohio-state-university-main-campus", displayName: "Ohio State University" },
  { unitId: "170976", slug: "university-of-michigan-ann-arbor", displayName: "University of Michigan" },
  { unitId: "228778", slug: "the-university-of-texas-at-austin", displayName: "UT Austin" },
];

describe("Phase 17 — real-data stable route regression", () => {
  for (const expected of EXPECTED) {
    it(`${expected.displayName} (UNITID ${expected.unitId}) has the expected stable slug`, () => {
      const college = colleges.find((c) => c.unitId === expected.unitId);
      expect(college, `UNITID ${expected.unitId} missing from dataset`).toBeDefined();
      expect(college!.slug).toBe(expected.slug);
      expect(getDisplayName(college!)).toBe(expected.displayName);
    });
  }

  it("Georgia Tech's old auto-generated slug is gone from the live dataset (it's a redirect now)", () => {
    expect(colleges.some((c) => c.slug === "georgia-institute-of-technology-main-campus")).toBe(false);
  });
});

describe("8. search results carry the stable slug", () => {
  it("UCLA search result's route matches its dataset record", () => {
    const [top] = searchColleges(colleges, "ucla", 1);
    expect(top.slug).toBe("university-of-california-los-angeles");
  });

  it("Georgia Tech search resolves to the pinned canonical slug", () => {
    const [top] = searchColleges(colleges, "georgia tech", 1);
    expect(top.slug).toBe("georgia-institute-of-technology");
  });
});

describe("9. nearby colleges link using the stable slug", () => {
  it("every nearby result's slug matches its own record in the dataset", () => {
    const nearby = getNearbyColleges("harvard-university", 6);
    for (const { college } of nearby) {
      const canonical = colleges.find((c) => c.unitId === college.unitId);
      expect(college.slug).toBe(canonical!.slug);
    }
  });
});
