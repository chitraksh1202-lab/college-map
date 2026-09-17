/**
 * Saved colleges persist by UNITID, not by slug. UNITID is the stable
 * identity; slug is just the institution's current URL. Storing slugs
 * would mean a saved college could "disappear" (or silently point at a
 * different institution) if its slug ever changes.
 */
const STORAGE_KEY = "college-explorer:saved-colleges:v2";
const LEGACY_STORAGE_KEY = "college-explorer:saved-colleges";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readList(key: string): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSavedUnitIds(unitIds: string[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unitIds));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently.
  }
}

/**
 * One-time migration from the old slug-keyed storage. Call with a
 * slug -> unitId map built from whatever college data is already on the
 * page (e.g. the Saved page's college list) — this module never imports
 * the dataset itself, to keep every island's bundle small. Safe to call
 * on every load: it's a no-op once the legacy key is empty/gone.
 */
export function migrateLegacySavedSlugs(slugToUnitId: Record<string, string>): void {
  if (!isBrowser()) return;
  const legacy = readList(LEGACY_STORAGE_KEY);
  if (legacy.length === 0) return;

  const current = new Set(readList(STORAGE_KEY));
  let migratedAny = false;
  for (const slug of legacy) {
    const unitId = slugToUnitId[slug];
    if (unitId && !current.has(unitId)) {
      current.add(unitId);
      migratedAny = true;
    }
  }

  if (migratedAny) {
    writeSavedUnitIds([...current]);
    window.dispatchEvent(new CustomEvent(SAVED_COLLEGES_EVENT));
  }
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function getSavedUnitIds(): string[] {
  return readList(STORAGE_KEY);
}

export function isCollegeSaved(unitId: string): boolean {
  return readList(STORAGE_KEY).includes(unitId);
}

export function saveCollege(unitId: string): string[] {
  const current = readList(STORAGE_KEY);
  if (current.includes(unitId)) return current;
  const next = [...current, unitId];
  writeSavedUnitIds(next);
  window.dispatchEvent(new CustomEvent(SAVED_COLLEGES_EVENT));
  return next;
}

export function unsaveCollege(unitId: string): string[] {
  const next = readList(STORAGE_KEY).filter((id) => id !== unitId);
  writeSavedUnitIds(next);
  window.dispatchEvent(new CustomEvent(SAVED_COLLEGES_EVENT));
  return next;
}

export function toggleSavedCollege(unitId: string): { saved: boolean; unitIds: string[] } {
  const saved = isCollegeSaved(unitId);
  const unitIds = saved ? unsaveCollege(unitId) : saveCollege(unitId);
  return { saved: !saved, unitIds };
}

export const SAVED_COLLEGES_EVENT = "saved-colleges:changed";
