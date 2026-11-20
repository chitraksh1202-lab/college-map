import type { College } from "@/lib/types";
import generatedInstitutions from "@/data/generated/institutions.json";
import { haversineMiles } from "@/lib/distance";

/**
 * Single access point for institution data. Everything else in the app
 * should import from here rather than from `data/generated/institutions.json`
 * directly, so the underlying data source can change without touching UI
 * code.
 *
 * `institutions.json` is produced by `npm run data:import`, which runs
 * three steps in sequence and commits their output:
 *   1. scripts/import-college-scorecard.ts — US institutions from the
 *      official College Scorecard bulk dataset (authoritative for the US).
 *   2. scripts/import-global-institutions.ts — non-US institutions from
 *      the Research Organization Registry (ROR).
 *   3. scripts/merge-global-dataset.ts — combines the two (US is never
 *      duplicated from the global source — see that script for why) and
 *      also writes the lightweight public/data/*.json assets the
 *      client-side map/search islands fetch instead of embedding the full
 *      global dataset in every page.
 *
 * The name "college" predates global expansion and is kept everywhere in
 * this codebase (types, routes, function names) as the general product
 * term for "explorable higher-education institution" — renaming it
 * site-wide would touch dozens of files for no functional benefit.
 */
const colleges = generatedInstitutions as College[];

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

export type CountrySummary = { countryCode: string; countryName: string; continent: string; count: number };

/** One entry per country that has at least one institution, sorted by count (largest first). */
export function getAllCountries(): CountrySummary[] {
  const byCode = new Map<string, CountrySummary>();
  for (const college of colleges) {
    const existing = byCode.get(college.countryCode);
    if (existing) {
      existing.count += 1;
    } else {
      byCode.set(college.countryCode, {
        countryCode: college.countryCode,
        countryName: college.countryName,
        continent: college.continent,
        count: 1,
      });
    }
  }
  return [...byCode.values()].sort((a, b) => b.count - a.count || a.countryName.localeCompare(b.countryName));
}

export function getCollegesByCountry(countryCode: string): College[] {
  return colleges.filter((college) => college.countryCode === countryCode.toUpperCase());
}

/**
 * US cities with enough colleges to be worth their own page (see
 * MIN_CITY_COLLEGES) — a real content-density bar, not a page generated
 * for every city that happens to have one small school. City is
 * disambiguated by state (there's a Portland in both Oregon and Maine),
 * so the identifying key is `${city}, ${stateCode}` and the route slug
 * is `${slugify(city)}-${stateCode}`.
 */
export type CityGroup = { citySlug: string; city: string; stateCode: string; count: number };
const MIN_CITY_COLLEGES = 4;

export function getCityGroups(): CityGroup[] {
  const byKey = new Map<string, CityGroup>();
  for (const college of colleges) {
    if (college.source !== "scorecard" || !college.stateCode) continue;
    const key = `${college.city}|${college.stateCode}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const citySlug = `${college.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${college.stateCode.toLowerCase()}`;
      byKey.set(key, { citySlug, city: college.city, stateCode: college.stateCode, count: 1 });
    }
  }
  return [...byKey.values()]
    .filter((c) => c.count >= MIN_CITY_COLLEGES)
    .sort((a, b) => b.count - a.count);
}

export function getCollegesByCitySlug(citySlug: string): College[] {
  const group = getCityGroups().find((c) => c.citySlug === citySlug);
  if (!group) return [];
  return colleges.filter((c) => c.city === group.city && c.stateCode === group.stateCode);
}

/**
 * Minimal shape for client-side islands (map markers, search) — the full
 * `College` record has ~25 fields but the map/search UI only ever needs
 * these. Passing this instead of the full record measurably shrinks what
 * gets serialized into island hydration props for page-scoped data (a
 * single state or college's own map). The homepage's world map/search use
 * a separately-generated public JSON asset instead of embedding this array
 * at all — see public/data/institutions-preview.json and
 * src/lib/client-data.ts.
 *
 * Includes `unitId` (not just `slug`) because saved colleges persist by
 * this stable identity — see src/lib/types.ts `College.unitId`.
 */
export type CollegePreview = Pick<
  College,
  | "unitId"
  | "slug"
  | "name"
  | "city"
  | "state"
  | "stateCode"
  | "countryCode"
  | "countryName"
  | "latitude"
  | "longitude"
  | "ownership"
  | "undergraduateEnrollment"
  | "aliases"
  | "campusSetting"
>;

function toPreview(college: College): CollegePreview {
  const {
    unitId,
    slug,
    name,
    city,
    state,
    stateCode,
    countryCode,
    countryName,
    latitude,
    longitude,
    ownership,
    undergraduateEnrollment,
    aliases,
    campusSetting,
  } = college;
  return {
    unitId,
    slug,
    name,
    city,
    state,
    stateCode,
    countryCode,
    countryName,
    latitude,
    longitude,
    ownership,
    undergraduateEnrollment,
    aliases,
    campusSetting,
  };
}

export function getAllCollegePreviews(): CollegePreview[] {
  return colleges.map(toPreview);
}

export function getCollegePreviewsByState(stateCode: string): CollegePreview[] {
  return getCollegesByState(stateCode).map(toPreview);
}

export function getCollegePreviewsByCountry(countryCode: string): CollegePreview[] {
  return getCollegesByCountry(countryCode).map(toPreview);
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
 * `getRandomCollege` there would pull the entire dataset into its browser
 * bundle for no reason. It fetches public/data/slugs.json lazily instead
 * of receiving this as a page prop (at ~24k institutions that list is no
 * longer "tiny enough to embed on every page" the way it was for ~1,800
 * US-only slugs).
 */
export function getAllSlugs(): string[] {
  return colleges.map((college) => college.slug);
}

export type NearbyCollege = { college: College; distanceMiles: number };

// Pre-partitioned by continent so `getNearbyColleges` (called once per
// college page at build time — ~24k times) only computes Haversine
// distance against the ~1-11k institutions on the same continent instead
// of the full worldwide dataset every time. Correctness trade-off: an
// institution within ~50mi of a continental boundary (e.g. the
// Bering Strait, the Bosphorus) could in principle have its true nearest
// neighbor one continent bucket over — accepted as negligible given how
// sparse institutions are near those specific boundaries, and there is a
// full-dataset fallback below if a continent bucket is ever too small to
// fill the requested list.
const collegesByContinent = new Map<string, College[]>();
for (const college of colleges) {
  const bucket = collegesByContinent.get(college.continent);
  if (bucket) bucket.push(college);
  else collegesByContinent.set(college.continent, [college]);
}

/** Nearest colleges by great-circle distance. Deterministic, no external service. */
export function getNearbyColleges(slug: string, limit = 6): NearbyCollege[] {
  const origin = getCollegeBySlug(slug);
  if (!origin) return [];

  const sameContinent = collegesByContinent.get(origin.continent) ?? colleges;
  const pool = sameContinent.length > limit ? sameContinent : colleges;

  return pool
    .filter((college) => college.slug !== slug)
    .map((college) => ({ college, distanceMiles: haversineMiles(origin, college) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}
