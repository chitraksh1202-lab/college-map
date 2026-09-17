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
 * Keyed by UNITID, not slug. UNITID is the permanent identity; slug is
 * just that identity's current URL (see src/data/curated/stable-slugs.json).
 * Joining curated data by slug would silently break if a slug ever moved.
 * A UNITID with no matching current record (e.g. it fell out of the
 * eligibility filter) simply stops matching rather than crashing anything.
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
  unitId: string;
  aliases: string[];
  /** Friendlier display name. Omit to just use the official Scorecard name. */
  displayName?: string;
};

export const curatedAliases: AliasEntry[] = [
  { unitId: "110662", aliases: ["ucla"], displayName: "UCLA" },
  { unitId: "110635", aliases: ["uc berkeley", "berkeley", "cal"], displayName: "UC Berkeley" },
  { unitId: "123961", aliases: ["usc", "southern cal"] },
  { unitId: "166683", aliases: ["mit"] },
  { unitId: "193900", aliases: ["nyu"] },
  { unitId: "139755", aliases: ["georgia tech", "gt"], displayName: "Georgia Institute of Technology" },
  { unitId: "233921", aliases: ["virginia tech", "vt"], displayName: "Virginia Tech" },
  { unitId: "129020", aliases: ["uconn"] },
  { unitId: "166629", aliases: ["umass amherst", "umass"], displayName: "UMass Amherst" },
  { unitId: "199120", aliases: ["unc", "unc chapel hill", "north carolina"], displayName: "UNC Chapel Hill" },
  { unitId: "145637", aliases: ["uiuc", "illinois"] },
  { unitId: "228778", aliases: ["ut austin", "texas"], displayName: "UT Austin" },
  { unitId: "228787", aliases: ["ut dallas", "utd"], displayName: "UT Dallas" },
  { unitId: "228723", aliases: ["texas a&m", "texas am", "tamu"], displayName: "Texas A&M University" },
  { unitId: "214777", aliases: ["penn state", "psu"], displayName: "Penn State" },
  { unitId: "204796", aliases: ["ohio state", "osu"], displayName: "Ohio State University" },
  { unitId: "104151", aliases: ["asu", "arizona state"], displayName: "Arizona State University" },
  { unitId: "170976", aliases: ["umich", "michigan"], displayName: "University of Michigan" },
  { unitId: "236948", aliases: ["uw", "washington"], displayName: "University of Washington" },
  { unitId: "240444", aliases: ["uw madison", "wisconsin"] },
  { unitId: "179867", aliases: ["washu"] },
  { unitId: "164988", aliases: ["bu"] },
  { unitId: "164924", aliases: ["bc"] },
  { unitId: "211440", aliases: ["cmu"] },
  { unitId: "110404", aliases: ["caltech"] },
  { unitId: "144050", aliases: ["uchicago", "u chicago"] },
  { unitId: "243744", aliases: ["stanford"] },
  { unitId: "166027", aliases: ["harvard"] },
  { unitId: "198419", aliases: ["duke"] },
  { unitId: "130794", aliases: ["yale"] },
  { unitId: "186131", aliases: ["princeton"] },
  { unitId: "134130", aliases: ["uf", "florida gators"] },
  { unitId: "228769", aliases: ["uta"], displayName: "UT Arlington" },
  { unitId: "229027", aliases: ["utsa"], displayName: "UT San Antonio" },
  { unitId: "228796", aliases: ["utep"], displayName: "UT El Paso" },
  { unitId: "159391", aliases: ["lsu"], displayName: "Louisiana State University" },
  { unitId: "110680", aliases: ["ucsd", "uc san diego"] },
  { unitId: "110644", aliases: ["uc davis", "ucd"] },
  { unitId: "110653", aliases: ["uc irvine", "uci"] },
  { unitId: "110705", aliases: ["ucsb", "uc santa barbara"] },
];
