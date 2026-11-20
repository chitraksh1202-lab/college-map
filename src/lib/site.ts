/**
 * Single source of truth for the production site URL. Change it here only
 * — astro.config.mjs (canonical/sitemap generation) and robots.txt both
 * import from this file rather than hardcoding it separately.
 *
 * TODO: replace with the real production domain before public launch.
 * No domain has been purchased/configured yet (deliberately out of scope
 * for this task) — this is a placeholder.
 */
export const SITE_URL = "https://college-map.chitraksh1202.workers.dev";

/**
 * Product name has not been finalized. Every place that displays it
 * (nav logo, page titles, OG tags) imports from here so renaming later
 * is a one-line change instead of a repo-wide find/replace.
 */
export const BRAND_NAME = "College Explorer";
