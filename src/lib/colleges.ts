import type { College } from "@/lib/types";
import { testColleges, getCollegeBySlug as getTestCollegeBySlug } from "@/data/test-colleges";

/**
 * Single access point for college data. Everything else in the app should
 * import from here rather than from `data/test-colleges` directly, so the
 * temporary dataset can later be swapped for `data/generated/colleges.json`
 * (produced by the real College Scorecard importer) without touching UI code.
 */
export function getAllColleges(): College[] {
  return testColleges;
}

export function getCollegeBySlug(slug: string): College | undefined {
  return getTestCollegeBySlug(slug);
}

export function getCollegesByState(stateCode: string): College[] {
  return testColleges.filter((college) => college.stateCode === stateCode.toUpperCase());
}

export function getFeaturedColleges(): College[] {
  return testColleges.filter((college) => college.featured);
}

export function getRandomCollege(excludeSlug?: string): College {
  const pool = excludeSlug
    ? testColleges.filter((college) => college.slug !== excludeSlug)
    : testColleges;
  const candidates = pool.length > 0 ? pool : testColleges;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}
