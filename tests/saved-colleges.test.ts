import { describe, it, expect, beforeEach, vi } from "vitest";

// jsdom-less unit test: stub a minimal localStorage/window so saved-colleges.ts's
// isBrowser() check passes and we can exercise real read/write logic.
function makeMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
}

beforeEach(() => {
  vi.resetModules();
  (globalThis as unknown as { window: Window }).window = {
    localStorage: makeMemoryStorage(),
    dispatchEvent: () => true,
    CustomEvent: class {} as unknown,
  } as unknown as Window;
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
});

describe("saved colleges persist by UNITID", () => {
  it("10. saveCollege/isCollegeSaved operate on UNITID strings", async () => {
    const { saveCollege, isCollegeSaved, getSavedUnitIds } = await import("../src/lib/saved-colleges");
    expect(isCollegeSaved("110662")).toBe(false);
    saveCollege("110662");
    expect(isCollegeSaved("110662")).toBe(true);
    expect(getSavedUnitIds()).toEqual(["110662"]);
  });

  it("migrateLegacySavedSlugs converts old slug-keyed saves to UNITIDs", async () => {
    const mod = await import("../src/lib/saved-colleges");
    // Simulate a pre-migration visitor who had saved by slug.
    window.localStorage.setItem(
      "college-explorer:saved-colleges",
      JSON.stringify(["university-of-california-los-angeles", "stanford-university"])
    );

    mod.migrateLegacySavedSlugs({
      "university-of-california-los-angeles": "110662",
      "stanford-university": "243744",
    });

    const migrated = mod.getSavedUnitIds().sort();
    expect(migrated).toEqual(["110662", "243744"]);
    // Legacy key should be cleared so migration doesn't re-run forever.
    expect(window.localStorage.getItem("college-explorer:saved-colleges")).toBeNull();
  });

  it("migration is a no-op (and safe) when there is nothing legacy to migrate", async () => {
    const mod = await import("../src/lib/saved-colleges");
    expect(() => mod.migrateLegacySavedSlugs({})).not.toThrow();
    expect(mod.getSavedUnitIds()).toEqual([]);
  });
});
