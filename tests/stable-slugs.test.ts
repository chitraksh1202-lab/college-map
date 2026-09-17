import { describe, it, expect } from "vitest";
import { resolveSlug, validateRedirects, slugify, type StableSlugRegistry } from "../scripts/lib/stable-slugs.ts";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("University of California-Los Angeles")).toBe("university-of-california-los-angeles");
  });
});

describe("resolveSlug", () => {
  it("1. an existing UNITID retains its slug even after its official name changes", () => {
    const registry: StableSlugRegistry = { "123": "example-college" };
    const first = resolveSlug({
      unitId: "123",
      name: "Example College",
      city: "Springfield",
      stateCode: "IL",
      registry,
      claimedSlugs: new Set(Object.values(registry)),
    });
    expect(first.slug).toBe("example-college");
    expect(first.isNew).toBe(false);

    // Simulate a later import where Scorecard renamed the institution.
    const second = resolveSlug({
      unitId: "123",
      name: "Example University-Main Campus",
      city: "Springfield",
      stateCode: "IL",
      registry,
      claimedSlugs: new Set(Object.values(registry)),
    });
    expect(second.slug).toBe("example-college");
    expect(second.isNew).toBe(false);
  });

  it("2. a brand-new institution gets a readable slug from its name", () => {
    const registry: StableSlugRegistry = {};
    const result = resolveSlug({
      unitId: "999",
      name: "New College",
      city: "Anytown",
      stateCode: "TX",
      registry,
      claimedSlugs: new Set(),
    });
    expect(result.slug).toBe("new-college");
    expect(result.isNew).toBe(true);
  });

  it("3. a name collision resolves deterministically via state, then city+state, then unitid", () => {
    const registry: StableSlugRegistry = { "1": "trinity-college" };
    const claimed = new Set(Object.values(registry));

    const secondTrinity = resolveSlug({
      unitId: "2",
      name: "Trinity College",
      city: "Hartford",
      stateCode: "CT",
      registry,
      claimedSlugs: claimed,
    });
    expect(secondTrinity.slug).toBe("trinity-college-ct");
    claimed.add(secondTrinity.slug);

    // A third "Trinity College" also in Connecticut, same city even —
    // forces the next tier.
    const thirdTrinity = resolveSlug({
      unitId: "3",
      name: "Trinity College",
      city: "Hartford",
      stateCode: "CT",
      registry,
      claimedSlugs: claimed,
    });
    expect(thirdTrinity.slug).toBe("trinity-college-hartford-ct");
    claimed.add(thirdTrinity.slug);

    // A fourth, identical on every axis — falls back to UNITID.
    const fourthTrinity = resolveSlug({
      unitId: "4",
      name: "Trinity College",
      city: "Hartford",
      stateCode: "CT",
      registry,
      claimedSlugs: claimed,
    });
    expect(fourthTrinity.slug).toBe("trinity-college-4");
  });

  it("4. a historical slug is never recycled to a different UNITID", () => {
    // UNITID 1 used to exist and claimed "example-college"; it's gone from
    // the *current* dataset but its registry entry (and therefore its
    // claimed slug) persists forever.
    const registry: StableSlugRegistry = { "1": "example-college" };
    const claimed = new Set(Object.values(registry));

    const newInstitution = resolveSlug({
      unitId: "2",
      name: "Example College",
      city: "Anytown",
      stateCode: "TX",
      registry,
      claimedSlugs: claimed,
    });

    expect(newInstitution.slug).not.toBe("example-college");
    expect(newInstitution.slug).toBe("example-college-tx");
  });
});

describe("validateRedirects", () => {
  const registry: StableSlugRegistry = {
    "1": "canonical-slug",
    "2": "other-canonical-slug",
  };

  it("accepts a valid redirect to a real canonical slug", () => {
    expect(validateRedirects({ "old-slug": "canonical-slug" }, registry)).toEqual([]);
  });

  it("6. rejects a redirect cycle/chain (source pointing at another redirect)", () => {
    const redirects = { a: "b", b: "canonical-slug" };
    const errors = validateRedirects(redirects, registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/chain/);
  });

  it("rejects a self-redirect", () => {
    const errors = validateRedirects({ "canonical-slug": "canonical-slug" }, registry);
    expect(errors.some((e) => e.includes("itself"))).toBe(true);
  });

  it("rejects a redirect to a slug that isn't any UNITID's canonical slug", () => {
    const errors = validateRedirects({ "old-slug": "no-such-slug" }, registry);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("5. rejects a redirect whose source is itself a live canonical slug (registry duplicate/shadowing)", () => {
    const errors = validateRedirects({ "other-canonical-slug": "canonical-slug" }, registry);
    expect(errors.some((e) => e.includes("shadow"))).toBe(true);
  });
});

describe("7. an existing UNITID cannot silently change its stable slug", () => {
  it("resolveSlug always returns the registered slug regardless of new input", () => {
    const registry: StableSlugRegistry = { "123456": "example-college" };
    const result = resolveSlug({
      unitId: "123456",
      name: "Totally Different Name University",
      city: "Elsewhere",
      stateCode: "NY",
      registry,
      claimedSlugs: new Set(Object.values(registry)),
    });
    // The importer itself throws loudly if a caller ever tried to persist
    // something other than this — this test locks in the pure-function
    // contract that makes that safeguard meaningful.
    expect(result.slug).toBe("example-college");
  });
});
