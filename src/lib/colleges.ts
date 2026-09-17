import type { College } from "@/lib/types";
import generatedColleges from "@/data/generated/colleges.json";
import { haversineMiles } from "@/lib/distance";

/**
 * Single access point for college data. Everything else in the app should
 * import from here rather than from `data/generated/colleges.json`
 * directly, so the underlying data source can change (e.g. a future
 * national-scale dataset) without touching UI code.
 *
 * `colleges.json` is produced by `npm run data:import`
 * (scripts/import-college-scorecard.ts) from the official US Dept of
 * Education College Scorecard API and is committed to the repo so static
 * builds don't require network access. Re-run the importer to refresh it.
 */
const colleges = generatedColleges as College[];

export function getAllColleges(): College[] {
  return colleges;
}

export function getCollegeBySlug(slug: string): College | undefined {
  return colleges.find((college) => college.slug === slug);
}

export function getCollegesByState(stateCode: string): College[] {
  return colleges.filter((college) => college.stateCode === stateCode.toUpperCase());
}

export function getFeaturedColleges(): College[] {
  return colleges.filter((college) => college.featured);
}

/**
 * Minimal shape for client-side islands (map markers, search) — the full
 * `College` record has ~20 fields but the map/search UI only ever needs
 * these 10. Passing this instead of the full record measurably shrinks
 * what gets serialized into island hydration props: the homepage HTML
 * dropped from ~3.4MB to a few hundred KB once both `MapExplorer` and
 * `SearchBox` switched to this shape instead of the full dataset.
 *
 * Includes `unitId` (not just `slug`) because saved colleges persist by
 * UNITID — the stable identity — not by slug, which is only the current
 * URL for that identity.
 */
export type CollegePreview = Pick<
  College,
  | "unitId"
  | "slug"
  | "name"
  | "city"
  | "state"
  | "stateCode"
  | "latitude"
  | "longitude"
  | "ownership"
  | "undergraduateEnrollment"
>;

function toPreview(college: College): CollegePreview {
  const { unitId, slug, name, city, state, stateCode, latitude, longitude, ownership, undergraduateEnrollment } = college;
  return { unitId, slug, name, city, state, stateCode, latitude, longitude, ownership, undergraduateEnrollment };
}

export function getAllCollegePreviews(): CollegePreview[] {
  return colleges.map(toPreview);
}

export function getCollegePreviewsByState(stateCode: string): CollegePreview[] {
  return getCollegesByState(stateCode).map(toPreview);
}

export function getRandomCollege(excludeSlugs: string[] = []): College {
  const excluded = new Set(excludeSlugs);
  const pool = colleges.filter((college) => !excluded.has(college.slug));
  const candidates = pool.length > 0 ? pool : colleges;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

/**
 * Slugs only — deliberately not the full dataset. `TeleportButton` is a
 * client-side island that just needs to pick a random slug; importing
 * `getRandomCollege` there would pull the entire ~1MB colleges.json into
 * its browser bundle for no reason. Server-rendered pages pass this
 * (tiny: ~20KB of short strings) down as a prop instead.
 */
export function getAllSlugs(): string[] {
  return colleges.map((college) => college.slug);
}

export type NearbyCollege = { college: College; distanceMiles: number };

/** Nearest colleges by great-circle distance. Deterministic, no external service. */
export function getNearbyColleges(slug: string, limit = 6): NearbyCollege[] {
  const origin = getCollegeBySlug(slug);
  if (!origin) return [];

  return colleges
    .filter((college) => college.slug !== slug)
    .map((college) => ({ college, distanceMiles: haversineMiles(origin, college) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}
