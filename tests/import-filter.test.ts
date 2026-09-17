import { describe, it, expect } from "vitest";
import { isEligible, parseNumeric, type RawRow } from "../scripts/import-college-scorecard.ts";
import { slugify } from "../scripts/lib/stable-slugs.ts";

const BASE: RawRow = {
  UNITID: "999999", INSTNM: "Test University", CITY: "Testville", STABBR: "CA",
  ZIP: "90000", INSTURL: "test.edu", CONTROL: "1", LOCALE: "11",
  LATITUDE: "34.0", LONGITUDE: "-118.0", ADM_RATE: "0.5", SAT_AVG: "1200",
  UGDS: "5000", TUITIONFEE_IN: "10000", TUITIONFEE_OUT: "20000",
  NPT4_PUB: "8000", NPT4_PRIV: "NA", C150_4: "0.6", MD_EARN_WNE_P10: "50000",
  CURROPER: "1", PREDDEG: "3", DISTANCEONLY: "NA",
};

function row(overrides: Partial<RawRow>): RawRow {
  return { ...BASE, ...overrides };
}

describe("parseNumeric", () => {
  it("parses valid numbers", () => {
    expect(parseNumeric("42")).toBe(42);
    expect(parseNumeric("0.5")).toBe(0.5);
  });
  it("treats missing-value tokens as undefined", () => {
    expect(parseNumeric("NA")).toBeUndefined();
    expect(parseNumeric("NULL")).toBeUndefined();
    expect(parseNumeric("PrivacySuppressed")).toBeUndefined();
    expect(parseNumeric("")).toBeUndefined();
    expect(parseNumeric(undefined)).toBeUndefined();
  });
});

describe("national eligibility filter", () => {
  it("accepts a normal currently-operating bachelor's-granting institution", () => {
    expect(isEligible(row({}))).toBe(true);
  });

  it("rejects closed institutions (CURROPER != 1)", () => {
    expect(isEligible(row({ CURROPER: "0" }))).toBe(false);
  });

  it("rejects non-bachelor's-predominant institutions (PREDDEG != 3)", () => {
    expect(isEligible(row({ PREDDEG: "1" }))).toBe(false); // certificate-predominant
    expect(isEligible(row({ PREDDEG: "2" }))).toBe(false); // associate-predominant
    expect(isEligible(row({ PREDDEG: "4" }))).toBe(false); // graduate-predominant
  });

  it("rejects institutions below the minimum undergrad enrollment floor", () => {
    expect(isEligible(row({ UGDS: "49" }))).toBe(false);
    expect(isEligible(row({ UGDS: "50" }))).toBe(true);
    expect(isEligible(row({ UGDS: "NA" }))).toBe(false);
  });

  it("rejects distance-only institutions", () => {
    expect(isEligible(row({ DISTANCEONLY: "1" }))).toBe(false);
  });

  it("rejects institutions with missing or invalid coordinates", () => {
    expect(isEligible(row({ LATITUDE: "NA" }))).toBe(false);
    expect(isEligible(row({ LONGITUDE: "NA" }))).toBe(false);
    expect(isEligible(row({ LATITUDE: "999" }))).toBe(false);
    expect(isEligible(row({ LONGITUDE: "-999" }))).toBe(false);
  });

  it("accepts all three ownership types", () => {
    expect(isEligible(row({ CONTROL: "1" }))).toBe(true);
    expect(isEligible(row({ CONTROL: "2" }))).toBe(true);
    expect(isEligible(row({ CONTROL: "3" }))).toBe(true);
  });

  it("rejects an unrecognized CONTROL value", () => {
    expect(isEligible(row({ CONTROL: "9" }))).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates institution names", () => {
    expect(slugify("University of California-Los Angeles")).toBe("university-of-california-los-angeles");
  });
  it("converts & to 'and'", () => {
    expect(slugify("Texas A&M University")).toBe("texas-aandm-university");
  });
  it("strips leading/trailing hyphens from punctuation-heavy names", () => {
    expect(slugify("St. John's College")).toBe("st-john-s-college");
    expect(slugify("!!!Weird Name!!!")).not.toMatch(/^-|-$/);
  });
});
