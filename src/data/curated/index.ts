import type { CuratedCollegeData } from "@/lib/types";
import { uclaCuratedData } from "@/data/curated/ucla";

/**
 * Registry of curated per-college data (campus tour points, editorial
 * summary, featured flag — see `CuratedCollegeData` in src/lib/types.ts).
 * UCLA is the proof-of-concept; the schema itself is already
 * college-agnostic, so adding deeper campus exploration for another
 * school is just:
 *
 *   1. add `src/data/curated/<slug>.ts` exporting a `CuratedCollegeData`
 *      (see ucla.ts for the verification/sourcing standard tour-point
 *      coordinates must meet — never guessed, never scraped from Google
 *      Maps, never AI-generated),
 *   2. add it to the array below.
 *
 * No page/route/component changes are needed — college/[slug].astro and
 * CampusExplorer.astro both already read through
 * `getCuratedDataByUnitId`, driven entirely by this data.
 */
const curatedColleges: CuratedCollegeData[] = [uclaCuratedData];

const curatedByUnitId: Record<string, CuratedCollegeData> = {};
for (const entry of curatedColleges) curatedByUnitId[entry.unitId] = entry;

export function getCuratedDataByUnitId(unitId: string): CuratedCollegeData | undefined {
  return curatedByUnitId[unitId];
}
