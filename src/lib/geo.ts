/**
 * Country routing helper for /country/[country] pages. Mirrors
 * scripts/lib/stable-slugs.ts's `slugify` (same rules) so a country's
 * generated page slug and its computed link from a college page always
 * agree — kept here (not imported from scripts/) because application code
 * never depends on the build-tooling scripts directory.
 */
export function countrySlugFor(countryName: string): string {
  return countryName
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
