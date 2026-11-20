import { describe, it, expect } from "vitest";
import {
  isActiveEducation,
  hasValidLocation,
  isNonUS,
  passesK12Filter,
  hasWebsite,
  isEligibleGlobalInstitution,
  normalizeGlobalInstitution,
  rorIdSuffix,
  officialName,
  aliasesOf,
  websiteOf,
  countrySlugFor,
  type RorRecord,
} from "../scripts/lib/global-institutions.ts";
import { resolveSlug, type StableSlugRegistry } from "../scripts/lib/stable-slugs.ts";

function makeRecord(overrides: Partial<RorRecord> = {}): RorRecord {
  return {
    id: "https://ror.org/052gg0110",
    status: "active",
    types: ["education"],
    names: [
      { value: "Oxford University", types: ["alias"], lang: "en" },
      { value: "University of Oxford", types: ["ror_display", "label"], lang: "en" },
    ],
    links: [{ type: "website", value: "https://www.ox.ac.uk" }],
    locations: [
      {
        geonames_details: {
          continent_code: "EU",
          continent_name: "Europe",
          country_code: "GB",
          country_name: "United Kingdom",
          country_subdivision_name: "England",
          lat: 51.75222,
          lng: -1.25596,
          name: "Oxford",
        },
      },
    ],
    ...overrides,
  };
}

describe("rorIdSuffix", () => {
  it("extracts the ID from a full ROR URL", () => {
    expect(rorIdSuffix("https://ror.org/052gg0110")).toBe("052gg0110");
  });
});

describe("officialName / aliasesOf / websiteOf", () => {
  it("prefers ror_display, and collects alias/acronym/label as lowercased aliases", () => {
    const record = makeRecord();
    expect(officialName(record)).toBe("University of Oxford");
    expect(aliasesOf(record)).toEqual(["oxford university", "university of oxford"]);
    expect(websiteOf(record)).toBe("https://www.ox.ac.uk/");
  });

  it("normalizes a website missing a scheme", () => {
    const record = makeRecord({ links: [{ type: "website", value: "ox.ac.uk" }] });
    expect(websiteOf(record)).toBe("https://ox.ac.uk/");
  });
});

describe("eligibility pipeline", () => {
  it("1. a real, active, non-US university with a website passes every stage", () => {
    const record = makeRecord();
    expect(isActiveEducation(record)).toBe(true);
    expect(hasValidLocation(record)).toBe(true);
    expect(isNonUS(record)).toBe(true);
    expect(passesK12Filter(record)).toBe(true);
    expect(hasWebsite(record)).toBe(true);
    expect(isEligibleGlobalInstitution(record)).toBe(true);
  });

  it("2. excludes inactive/withdrawn records", () => {
    const record = makeRecord({ status: "inactive" });
    expect(isActiveEducation(record)).toBe(false);
    expect(isEligibleGlobalInstitution(record)).toBe(false);
  });

  it("3. excludes non-education org types (e.g. a hospital or company)", () => {
    const record = makeRecord({ types: ["healthcare"] });
    expect(isActiveEducation(record)).toBe(false);
  });

  it("4. excludes records with missing/invalid coordinates", () => {
    const noCoords = makeRecord({
      locations: [{ geonames_details: { country_code: "GB", name: "Oxford" } }],
    });
    expect(hasValidLocation(noCoords)).toBe(false);

    const nullIsland = makeRecord({
      locations: [{ geonames_details: { country_code: "GB", lat: 0, lng: 0, name: "Oxford" } }],
    });
    expect(hasValidLocation(nullIsland)).toBe(false);
  });

  it("5. excludes US institutions — College Scorecard remains sole US authority", () => {
    const record = makeRecord({
      locations: [
        {
          geonames_details: {
            continent_code: "NA",
            continent_name: "North America",
            country_code: "US",
            country_name: "United States",
            lat: 42.36,
            lng: -71.09,
            name: "Cambridge",
          },
        },
      ],
    });
    expect(isNonUS(record)).toBe(false);
    expect(isEligibleGlobalInstitution(record)).toBe(false);
  });

  it("6. excludes unambiguous K-12/early-years institutions by name", () => {
    const record = makeRecord({
      names: [{ value: "Oxford Elementary School", types: ["ror_display", "label"], lang: "en" }],
    });
    expect(passesK12Filter(record)).toBe(false);
    expect(isEligibleGlobalInstitution(record)).toBe(false);
  });

  it("does not flag a real university whose name merely contains 'college'", () => {
    const record = makeRecord({
      names: [{ value: "Imperial College London", types: ["ror_display", "label"], lang: "en" }],
    });
    expect(passesK12Filter(record)).toBe(true);
  });

  it("7. excludes records with no website (content-quality gate)", () => {
    const record = makeRecord({ links: [] });
    expect(hasWebsite(record)).toBe(false);
    expect(isEligibleGlobalInstitution(record)).toBe(false);
  });
});

describe("normalizeGlobalInstitution", () => {
  it("8. produces the shared College shape with a ror: unitId and no US-only fields", () => {
    const institution = normalizeGlobalInstitution(makeRecord(), "university-of-oxford");
    expect(institution.unitId).toBe("ror:052gg0110");
    expect(institution.source).toBe("ror");
    expect(institution.slug).toBe("university-of-oxford");
    expect(institution.city).toBe("Oxford");
    expect(institution.countryCode).toBe("GB");
    expect(institution.countryName).toBe("United Kingdom");
    expect(institution.continent).toBe("Europe");
    expect(institution.stateCode).toBeUndefined();
    expect(institution.ownership).toBeUndefined();
    expect(institution.undergraduateEnrollment).toBeUndefined();
    expect(institution.aliases).toContain("oxford university");
  });
});

describe("9. global slugs share the same registry/resolution logic as US slugs, without colliding", () => {
  it("a US UNITID and a ror: id can never collide because their formats are disjoint", () => {
    const registry: StableSlugRegistry = { "110662": "university-of-california-los-angeles" };
    const claimed = new Set(Object.values(registry));

    const global = resolveSlug({
      unitId: "ror:052gg0110",
      name: "University of Oxford",
      city: "Oxford",
      stateCode: "GB",
      registry,
      claimedSlugs: claimed,
    });
    expect(global.isNew).toBe(true);
    expect(global.slug).toBe("university-of-oxford");
    expect(registry["110662"]).toBe("university-of-california-los-angeles"); // untouched
  });
});

describe("countrySlugFor", () => {
  it("10. produces a readable, URL-safe country slug", () => {
    expect(countrySlugFor("United Kingdom")).toBe("united-kingdom");
    expect(countrySlugFor("Côte d'Ivoire")).not.toMatch(/[^a-z0-9-]/);
  });
});
