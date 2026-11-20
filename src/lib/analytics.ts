/**
 * Minimal analytics abstraction. No vendor is wired in yet — `track()`
 * forwards to `window.plausible` (Plausible) or `window.dataLayer` (GA4)
 * if either happens to be present, and otherwise just logs in dev. This
 * exists so every call site (components, pages, the click-delegation
 * script in BaseLayout) uses one stable, named set of events instead of
 * hard-wiring a specific vendor's SDK throughout the UI. Adding a real
 * vendor later is a change to this one file, not a repo-wide edit.
 *
 * Never throws, never blocks the UI it's called from.
 */
export type AnalyticsEvent =
  | "college_opened"
  | "college_saved"
  | "college_removed"
  | "atlas_opened"
  | "nearby_college_opened"
  | "surprise_me_used"
  | "place_lens_selected"
  | "campus_explore_opened"
  | "search_result_opened";

type EventProps = Record<string, string | number | boolean | undefined>;

export function track(event: AnalyticsEvent, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as {
      plausible?: (event: string, options?: { props: EventProps }) => void;
      dataLayer?: unknown[];
    };
    if (typeof w.plausible === "function") w.plausible(event, { props });
    if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event, ...props });
    if (import.meta.env?.DEV) console.debug("[analytics]", event, props);
  } catch {
    // Analytics must never break the product.
  }
}
