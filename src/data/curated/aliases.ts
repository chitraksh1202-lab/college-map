/**
 * Curated search aliases and display-name overrides for nationally
 * prominent institutions.
 *
 * This is CURATED data (hand-verified by us), kept fully separate from
 * the official College Scorecard fields in `generated/colleges.json` —
 * we never rewrite `name` (the official INSTNM), we only add search
 * hints and an optional friendlier `displayName` for the ~35-50 schools
 * students actually search for by nickname/abbreviation.
 *
 * `slug` must match an existing `College.slug` exactly (auto-generated
 * from the official name by the importer) — these are not looked up by
 * name, so a slug that no longer exists after a re-import simply stops
 * matching rather than crashing anything.
 *
 * Ambiguous abbreviations: "USC" is deliberately aliased ONLY to the
 * University of Southern California, even though "University of South
 * Carolina-Columbia" also exists in the dataset — USC-California is the
 * overwhelmingly dominant everyday usage of the bare abbreviation "USC."
 * South Carolina's flagship is still fully findable by name/city search
 * without an alias. We do not add ambiguous aliases we aren't confident
 * about; when in doubt we simply omit the alias and let name/city search
 * handle it.
 */
export type AliasEntry = {
  slug: string;
  aliases: string[];
  /** Friendlier display name. Omit to just use the official Scorecard name. */
  displayName?: string;
};

export const curatedAliases: AliasEntry[] = [
  { slug: "university-of-california-los-angeles", aliases: ["ucla"], displayName: "UCLA" },
  { slug: "university-of-california-berkeley", aliases: ["uc berkeley", "berkeley", "cal"], displayName: "UC Berkeley" },
  { slug: "university-of-southern-california", aliases: ["usc", "southern cal"] },
  { slug: "massachusetts-institute-of-technology", aliases: ["mit"] },
  { slug: "new-york-university", aliases: ["nyu"] },
  { slug: "georgia-institute-of-technology-main-campus", aliases: ["georgia tech", "gt"], displayName: "Georgia Institute of Technology" },
  { slug: "virginia-polytechnic-institute-and-state-university", aliases: ["virginia tech", "vt"], displayName: "Virginia Tech" },
  { slug: "university-of-connecticut", aliases: ["uconn"] },
  { slug: "university-of-massachusetts-amherst", aliases: ["umass amherst", "umass"], displayName: "UMass Amherst" },
  { slug: "university-of-north-carolina-at-chapel-hill", aliases: ["unc", "unc chapel hill", "north carolina"], displayName: "UNC Chapel Hill" },
  { slug: "university-of-illinois-urbana-champaign", aliases: ["uiuc", "illinois"] },
  { slug: "the-university-of-texas-at-austin", aliases: ["ut austin", "texas"], displayName: "UT Austin" },
  { slug: "the-university-of-texas-at-dallas", aliases: ["ut dallas", "utd"], displayName: "UT Dallas" },
  { slug: "texas-aandm-university-college-station", aliases: ["texas a&m", "texas am", "tamu"], displayName: "Texas A&M University" },
  { slug: "pennsylvania-state-university-main-campus", aliases: ["penn state", "psu"], displayName: "Penn State" },
  { slug: "ohio-state-university-main-campus", aliases: ["ohio state", "osu"], displayName: "Ohio State University" },
  { slug: "arizona-state-university-campus-immersion", aliases: ["asu", "arizona state"], displayName: "Arizona State University" },
  { slug: "university-of-michigan-ann-arbor", aliases: ["umich", "michigan"], displayName: "University of Michigan" },
  { slug: "university-of-washington-seattle-campus", aliases: ["uw", "washington"], displayName: "University of Washington" },
  { slug: "university-of-wisconsin-madison", aliases: ["uw madison", "wisconsin"] },
  { slug: "washington-university-in-st-louis", aliases: ["washu"] },
  { slug: "boston-university", aliases: ["bu"] },
  { slug: "boston-college", aliases: ["bc"] },
  { slug: "carnegie-mellon-university", aliases: ["cmu"] },
  { slug: "california-institute-of-technology", aliases: ["caltech"] },
  { slug: "university-of-chicago", aliases: ["uchicago", "u chicago"] },
  { slug: "stanford-university", aliases: ["stanford"] },
  { slug: "harvard-university", aliases: ["harvard"] },
  { slug: "duke-university", aliases: ["duke"] },
  { slug: "yale-university", aliases: ["yale"] },
  { slug: "princeton-university", aliases: ["princeton"] },
  { slug: "university-of-florida", aliases: ["uf", "florida gators"] },
  { slug: "the-university-of-texas-at-arlington", aliases: ["uta"], displayName: "UT Arlington" },
  { slug: "the-university-of-texas-at-san-antonio", aliases: ["utsa"], displayName: "UT San Antonio" },
  { slug: "the-university-of-texas-at-el-paso", aliases: ["utep"], displayName: "UT El Paso" },
  { slug: "louisiana-state-university-and-agricultural-and-mechanical-college", aliases: ["lsu"], displayName: "Louisiana State University" },
  { slug: "university-of-california-san-diego", aliases: ["ucsd", "uc san diego"] },
  { slug: "university-of-california-davis", aliases: ["uc davis", "ucd"] },
  { slug: "university-of-california-irvine", aliases: ["uc irvine", "uci"] },
  { slug: "university-of-california-santa-barbara", aliases: ["ucsb", "uc santa barbara"] },
];
