import type { College } from "@/lib/types";
import { curatedAliases } from "@/data/curated/aliases";

/** Everything search/display needs — satisfied by both `College` and `CollegePreview`. */
type Searchable = Pick<
  College,
  "unitId" | "slug" | "name" | "city" | "state" | "stateCode" | "undergraduateEnrollment"
>;

// Aliases/display names are curated data keyed by UNITID (the stable
// identity) — see src/data/curated/aliases.ts for why.
const aliasByUnitId = new Map<string, string[]>();
const displayNameByUnitId = new Map<string, string>();
for (const entry of curatedAliases) {
  aliasByUnitId.set(entry.unitId, entry.aliases.map((a) => a.toLowerCase().trim()));
  if (entry.displayName) displayNameByUnitId.set(entry.unitId, entry.displayName);
}

/** Curated friendly name if one exists, otherwise the official Scorecard name. */
export function getDisplayName(college: Pick<Searchable, "unitId" | "name">): string {
  return displayNameByUnitId.get(college.unitId) ?? college.name;
}

function norm(s: string): string {
  return s.toLowerCase().trim();
}

function wordsOf(s: string): string[] {
  return s.split(/[^a-z0-9]+/).filter(Boolean);
}

const RANK = {
  ALIAS_EXACT: 0,
  NAME_EXACT: 1,
  NAME_STARTS: 2,
  NAME_WORD_STARTS: 3,
  NAME_CONTAINS: 4,
  CITY_STARTS: 5,
  CITY_CONTAINS: 6,
  STATE_MATCH: 7,
  NONE: Infinity,
} as const;

/**
 * Deterministic relevance tier for one college against a query — no AI,
 * no external search service. Lower is better. See RANK above for the
 * priority order (alias/abbreviation match first, state-name match last).
 */
function rankCollege(college: Searchable, query: string): number {
  const aliases = aliasByUnitId.get(college.unitId) ?? [];
  const displayName = norm(getDisplayName(college));
  const officialName = norm(college.name);
  const city = norm(college.city);
  const state = norm(college.state);
  const stateCode = norm(college.stateCode);

  if (aliases.includes(query)) return RANK.ALIAS_EXACT;
  if (officialName === query || displayName === query) return RANK.NAME_EXACT;
  if (officialName.startsWith(query) || displayName.startsWith(query)) return RANK.NAME_STARTS;

  const nameWords = [...wordsOf(officialName), ...wordsOf(displayName)];
  if (nameWords.some((w) => w.startsWith(query))) return RANK.NAME_WORD_STARTS;

  if (officialName.includes(query) || displayName.includes(query)) return RANK.NAME_CONTAINS;
  if (city.startsWith(query)) return RANK.CITY_STARTS;
  if (city.includes(query)) return RANK.CITY_CONTAINS;
  if (state === query || stateCode === query || state.startsWith(query)) return RANK.STATE_MATCH;

  return RANK.NONE;
}

/**
 * Ranked, deterministic client-side search. Ties within the same
 * relevance tier are broken by undergraduate enrollment (descending) as a
 * simple, factual prominence signal — this is what keeps e.g. "florida"
 * surfacing University of Florida (35k+ undergrads) ahead of a
 * similarly-named but tiny institution, without hand-curating every
 * ambiguous case.
 */
export function searchColleges<T extends Searchable>(colleges: T[], query: string, limit = 15): T[] {
  const q = norm(query);
  if (q.length === 0) return [];

  const ranked: { college: T; rank: number }[] = [];
  for (const college of colleges) {
    const rank = rankCollege(college, q);
    if (rank !== RANK.NONE) ranked.push({ college, rank });
  }

  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const enrollA = a.college.undergraduateEnrollment ?? 0;
    const enrollB = b.college.undergraduateEnrollment ?? 0;
    if (enrollA !== enrollB) return enrollB - enrollA;
    return a.college.name.localeCompare(b.college.name);
  });

  return ranked.slice(0, limit).map((r) => r.college);
}
