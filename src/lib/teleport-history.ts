const STORAGE_KEY = "college-explorer:teleport-history";
const MAX_HISTORY = 8;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readHistory(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(slugs: string[]): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slugs.slice(-MAX_HISTORY)));
  } catch {
    // sessionStorage unavailable — fail silently, teleport still works without history.
  }
}

export function recordTeleport(slug: string): void {
  const history = readHistory();
  writeHistory([...history, slug]);
}

/** Recently teleported-to slugs this browser session, oldest first. Recycles once the cap is hit. */
export function getTeleportHistory(): string[] {
  return readHistory();
}
