/**
 * Official data: derived from authoritative sources (eventually US Dept of
 * Education College Scorecard). Never fabricated. Missing fields stay
 * undefined rather than being filled with placeholder numbers.
 */
export type Ownership = "public" | "private-nonprofit" | "private-for-profit";

export type College = {
  id: string;
  unitId: string;
  slug: string;

  name: string;
  shortName?: string;

  city: string;
  state: string;
  stateCode: string;
  zip?: string;

  latitude: number;
  longitude: number;

  ownership?: Ownership;

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
