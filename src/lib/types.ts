/**
 * Official data: derived from authoritative sources (eventually US Dept of
 * Education College Scorecard). Never fabricated. Missing fields stay
 * undefined rather than being filled with placeholder numbers.
 */
export type Ownership = "public" | "private-nonprofit" | "private-for-profit";

/**
 * Where an institution's record originated. "scorecard" institutions are
 * US four-year colleges from the Dept of Education College Scorecard bulk
 * dataset (rich stats, always authoritative for the US — see
 * scripts/import-college-scorecard.ts). "ror" institutions are non-US
 * universities from the Research Organization Registry (identity/location
 * only — see scripts/import-global-institutions.ts). The two are never
 * merged for the same institution; US coverage always comes from
 * Scorecard, never from ROR (see scripts/merge-global-dataset.ts).
 */
export type InstitutionSource = "scorecard" | "ror";

export type College = {
  id: string;
  /**
   * The permanent cross-source identity. For `source: "scorecard"` this is
   * the raw IPEDS UNITID (e.g. "110662"), unchanged from before global
   * expansion — every existing saved college / stable slug keeps working
   * with zero migration. For `source: "ror"` this is `ror:<id>` (e.g.
   * "ror:049a2xr35"), which can never collide with a Scorecard UNITID.
   */
  unitId: string;
  slug: string;
  source: InstitutionSource;

  name: string;
  shortName?: string;

  city: string;
  /** US: full state name. Non-US: region/province name if known, else undefined. */
  state?: string;
  /** US only. */
  stateCode?: string;
  zip?: string;

  countryCode: string;
  countryName: string;
  continent: string;

  latitude: number;
  longitude: number;

  /** US ownership classification. Not applicable to `source: "ror"` institutions. */
  ownership?: Ownership;
  /** Non-US institution type label (ROR does not subdivide further than "education"). */
  institutionType?: string;
  /**
   * Search aliases/acronyms derived directly from the source record (ROR
   * `alias`/`acronym`/`label` names). Distinct from
   * `src/data/curated/aliases.ts`, which is hand-curated for a subset of
   * (mostly US) institutions — this field is official/derived, not edited
   * by us.
   */
  aliases?: string[];

  undergraduateEnrollment?: number;
  admissionRate?: number;

  tuitionInState?: number;
  tuitionOutOfState?: number;
  averageNetPrice?: number;

  graduationRate?: number;
  medianEarnings?: number;
  satAverage?: number;

  campusSetting?: string;

  website?: string;

  featured: boolean;
};

/**
 * Curated data: created or manually verified by us. Kept separate from
 * official data so the two can be sourced, edited, and regenerated
 * independently.
 */
export type CampusTourPointCategory =
  | "landmark"
  | "academic"
  | "residential"
  | "student-life"
  | "sports"
  | "surrounding-area";

export type CampusTourPoint = {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: CampusTourPointCategory;
  /** True if the coordinate is a placeholder pending manual verification. */
  unverified?: boolean;
  /** Short provenance note — where this coordinate was verified against. */
  source?: string;
};

export type CuratedCollegeData = {
  unitId: string;
  featured?: boolean;
  campusSettingOverride?: string;
  tourPoints?: CampusTourPoint[];
  youtubeTourUrl?: string;
  editorialSummary?: string;
};
