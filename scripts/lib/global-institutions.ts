/**
 * Pure normalization/eligibility logic for the global (non-US) institution
 * pipeline, kept separate from scripts/import-global-institutions.ts (which
 * does the network/disk I/O) so it can be unit tested without touching the
 * network or a 300MB+ file.
 *
 * Source: the Research Organization Registry (ROR) official data dump
 * (https://ror.org/, published to Zenodo, community "ror-data"). ROR was
 * chosen over querying the live ROR/OpenAlex REST APIs because it ships a
 * single versioned, reproducible bulk file — no pagination, no rate
 * limits, no API key, and OpenAlex's own institution identity IS a ROR ID,
 * so there is no benefit to going through OpenAlex for identity data.
 *
 * See scripts/import-global-institutions.ts for the exact filter pipeline
 * and diagnostic counts this feeds into.
 */
import type { College } from "../../src/lib/types.ts";
import { slugify } from "./stable-slugs.ts";

export type RorLocation = {
  geonames_details?: {
    continent_code?: string;
    continent_name?: string;
    country_code?: string;
    country_name?: string;
    country_subdivision_code?: string;
    country_subdivision_name?: string;
    lat?: number;
    lng?: number;
    name?: string;
  };
};

export type RorName = { value: string; types: string[]; lang?: string | null };
export type RorLink = { type: string; value: string };

export type RorRecord = {
  id: string;
  status?: string;
  types?: string[];
  locations?: RorLocation[];
  names?: RorName[];
  links?: RorLink[];
};

/**
 * Documented, deliberately narrow exclusion of unambiguous K-12/early-years
 * institutions that ROR's "education" type does not itself distinguish
 * from higher education. This is the ONE heuristic in this pipeline beyond
 * ROR's own categorization — kept as a denylist (excludes only unambiguous
 * matches) rather than an allowlist, because a keyword allowlist for
 * "university/college/institute" would incorrectly exclude real
 * institutions with non-standard names (e.g. "Sciences Po", "ETH Zurich",
 * "Technion"). Matches are intentionally conservative to avoid false
 * positives.
 */
export const K12_DENYLIST =
  /\b(elementary school|primary school|secondary school|nursery school|kindergarten|high school)\b/i;

export function rorIdSuffix(rorUrl: string): string {
  const match = rorUrl.match(/ror\.org\/([a-z0-9]+)/i);
  return match ? match[1] : rorUrl;
}

export function primaryLocation(record: RorRecord): RorLocation | undefined {
  return record.locations?.[0];
}

/** ROR's own preferred display name, falling back to the first available name. */
export function officialName(record: RorRecord): string {
  const names = record.names ?? [];
  const display = names.find((n) => n.types?.includes("ror_display"));
  if (display) return display.value;
  const label = names.find((n) => n.types?.includes("label"));
  if (label) return label.value;
  return names[0]?.value ?? "";
}

/** Lowercased, deduped acronyms/aliases/labels for search matching. */
export function aliasesOf(record: RorRecord): string[] {
  const names = record.names ?? [];
  const values = names
    .filter((n) => n.types?.some((t) => t === "alias" || t === "acronym" || t === "label"))
    .map((n) => n.value.toLowerCase().trim())
    .filter(Boolean);
  return [...new Set(values)];
}

export function websiteOf(record: RorRecord): string | undefined {
  const link = (record.links ?? []).find((l) => l.type === "website" && l.value);
  if (!link) return undefined;
  const withScheme = /^https?:\/\//i.test(link.value) ? link.value : `https://${link.value}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
}

/** Stage 1: ROR's own categorization — active status, typed "education". */
export function isActiveEducation(record: RorRecord): boolean {
  return record.status === "active" && (record.types ?? []).includes("education");
}

/** Stage 2: has a usable primary location — country + valid, non-null-island coordinates. */
export function hasValidLocation(record: RorRecord): boolean {
  const loc = primaryLocation(record)?.geonames_details;
  if (!loc) return false;
  const { lat, lng, country_code } = loc;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return Boolean(country_code);
}

/** Stage 3: US institutions are excluded — College Scorecard remains sole US authority (Phase 3/8). */
export function isNonUS(record: RorRecord): boolean {
  return primaryLocation(record)?.geonames_details?.country_code !== "US";
}

/** Stage 4: exclude unambiguous K-12/early-years institutions (see K12_DENYLIST). */
export function passesK12Filter(record: RorRecord): boolean {
  return !K12_DENYLIST.test(officialName(record));
}

/**
 * Stage 5: require a website. Not a ROR eligibility concept — a deliberate
 * content-quality gate for THIS product: an institution with no verifiable
 * link at all is too thin to give its own page (CLAUDE.md: "do not create
 * spammy programmatic pages"). Institutions failing this stage are not
 * included anywhere (map/search/pages) rather than being shown with a
 * dead-end page.
 */
export function hasWebsite(record: RorRecord): boolean {
  return websiteOf(record) !== undefined;
}

export function isEligibleGlobalInstitution(record: RorRecord): boolean {
  return (
    isActiveEducation(record) &&
    hasValidLocation(record) &&
    isNonUS(record) &&
    passesK12Filter(record) &&
    hasWebsite(record)
  );
}

/** Normalizes one eligible ROR record into the shared `College` shape. Pure — takes the slug already resolved. */
export function normalizeGlobalInstitution(record: RorRecord, slug: string): College {
  const loc = primaryLocation(record)!.geonames_details!;
  const name = officialName(record);

  return {
    id: slug,
    unitId: `ror:${rorIdSuffix(record.id)}`,
    slug,
    source: "ror",
    name,
    city: loc.name ?? "",
    state: loc.country_subdivision_name,
    stateCode: undefined,
    countryCode: loc.country_code!,
    countryName: loc.country_name ?? loc.country_code!,
    continent: loc.continent_name ?? "Unknown",
    latitude: loc.lat!,
    longitude: loc.lng!,
    institutionType: "Higher education institution",
    website: websiteOf(record),
    aliases: aliasesOf(record).filter((a) => a.toLowerCase() !== name.toLowerCase()),
    featured: false,
  };
}

/** Country slug for /country/[country] routes — same convention as state slugs. */
export function countrySlugFor(countryName: string): string {
  return slugify(countryName);
}
