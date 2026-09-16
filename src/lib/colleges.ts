import type { College } from "@/lib/types";
import generatedColleges from "@/data/generated/colleges.json";

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

export function getRandomCollege(excludeSlug?: string): College {
  const pool = excludeSlug
    ? colleges.filter((college) => college.slug !== excludeSlug)
    : colleges;
  const candidates = pool.length > 0 ? pool : colleges;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}
