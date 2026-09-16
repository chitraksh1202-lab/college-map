const STORAGE_KEY = "college-explorer:saved-colleges";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readSavedSlugs(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSavedSlugs(slugs: string[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently.
  }
}

export function getSavedSlugs(): string[] {
  return readSavedSlugs();
}

export function isCollegeSaved(slug: string): boolean {
  return readSavedSlugs().includes(slug);
}

export function saveCollege(slug: string): string[] {
  const current = readSavedSlugs();
  if (current.includes(slug)) return current;
  const next = [...current, slug];
  writeSavedSlugs(next);
  window.dispatchEvent(new CustomEvent("saved-colleges:changed"));
  return next;
}

export function unsaveCollege(slug: string): string[] {
  const next = readSavedSlugs().filter((s) => s !== slug);
  writeSavedSlugs(next);
  window.dispatchEvent(new CustomEvent("saved-colleges:changed"));
  return next;
}

export function toggleSavedCollege(slug: string): { saved: boolean; slugs: string[] } {
  const saved = isCollegeSaved(slug);
  const slugs = saved ? unsaveCollege(slug) : saveCollege(slug);
  return { saved: !saved, slugs };
}

export const SAVED_COLLEGES_EVENT = "saved-colleges:changed";
