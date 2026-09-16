/**
 * The ~20 institutions this vertical slice targets, identified by search
 * hints (not by trusting a memorized UNITID). `knownUnitId` is only filled
 * in for institutions independently confirmed live during development
 * (see import script comments) — the importer still re-verifies every
 * entry (known or not) against the downloaded College Scorecard bulk CSV
 * by name/city/state before accepting a row, and fails loudly on any
 * mismatch or ambiguity rather than guessing. Slugs must stay identical to
 * the ones the original prototype dataset used so `/college/[slug]` routes
 * don't move.
 */
export type ManifestEntry = {
  slug: string;
  searchName: string;
  expectedCity: string;
  expectedState: string;
  /** Only set when confirmed live against the Scorecard API during development. */
  knownUnitId?: number;
};

export const institutionManifest: ManifestEntry[] = [
  // --- California ---
  {
    slug: "university-of-california-los-angeles",
    searchName: "University of California-Los Angeles",
    expectedCity: "Los Angeles",
    expectedState: "CA",
    knownUnitId: 110662,
  },
  {
    slug: "university-of-california-berkeley",
    searchName: "University of California-Berkeley",
    expectedCity: "Berkeley",
    expectedState: "CA",
    knownUnitId: 110635,
  },
  {
    slug: "stanford-university",
    searchName: "Stanford University",
    expectedCity: "Stanford",
    expectedState: "CA",
    knownUnitId: 243744,
  },
  {
    slug: "university-of-southern-california",
    searchName: "University of Southern California",
    expectedCity: "Los Angeles",
    expectedState: "CA",
    knownUnitId: 123961,
  },
  {
    slug: "university-of-california-san-diego",
    searchName: "University of California-San Diego",
    expectedCity: "La Jolla",
    expectedState: "CA",
  },
  {
    slug: "california-institute-of-technology",
    searchName: "California Institute of Technology",
    expectedCity: "Pasadena",
    expectedState: "CA",
  },
  {
    slug: "san-diego-state-university",
    searchName: "San Diego State University",
    expectedCity: "San Diego",
    expectedState: "CA",
  },

  // --- Other states ---
  {
    slug: "harvard-university",
    searchName: "Harvard University",
    expectedCity: "Cambridge",
    expectedState: "MA",
  },
  {
    slug: "massachusetts-institute-of-technology",
    searchName: "Massachusetts Institute of Technology",
    expectedCity: "Cambridge",
    expectedState: "MA",
  },
  {
    slug: "yale-university",
    searchName: "Yale University",
    expectedCity: "New Haven",
    expectedState: "CT",
  },
  {
    slug: "princeton-university",
    searchName: "Princeton University",
    expectedCity: "Princeton",
    expectedState: "NJ",
  },
  {
    slug: "university-of-michigan",
    searchName: "University of Michigan-Ann Arbor",
    expectedCity: "Ann Arbor",
    expectedState: "MI",
  },
  {
    slug: "university-of-texas-at-austin",
    searchName: "University of Texas at Austin",
    expectedCity: "Austin",
    expectedState: "TX",
  },
  {
    slug: "university-of-florida",
    searchName: "University of Florida",
    expectedCity: "Gainesville",
    expectedState: "FL",
  },
  {
    slug: "ohio-state-university",
    searchName: "Ohio State University-Main Campus",
    expectedCity: "Columbus",
    expectedState: "OH",
  },
  {
    slug: "university-of-washington",
    searchName: "University of Washington-Seattle Campus",
    expectedCity: "Seattle",
    expectedState: "WA",
  },
  {
    slug: "arizona-state-university",
    searchName: "Arizona State University",
    expectedCity: "Tempe",
    expectedState: "AZ",
  },
  {
    slug: "georgia-institute-of-technology",
    searchName: "Georgia Institute of Technology-Main Campus",
    expectedCity: "Atlanta",
    expectedState: "GA",
  },
  {
    slug: "university-of-chicago",
    searchName: "University of Chicago",
    expectedCity: "Chicago",
    expectedState: "IL",
  },
  {
    slug: "duke-university",
    searchName: "Duke University",
    expectedCity: "Durham",
    expectedState: "NC",
  },
];
