/**
 * College Scorecard bulk-download import pipeline — national scale.
 *
 * Run with: npm run data:import
 * Force a fresh download: npm run data:import -- --refresh
 *
 * What this does:
 *   1. Downloads the official "Most Recent Institution-Level Data" ZIP from
 *      the US Dept of Education College Scorecard data page
 *      (https://collegescorecard.ed.gov/data/) — no API, no API key.
 *      Caches the ZIP and the extracted CSV under `src/data/raw/`
 *      (gitignored) and reuses that cache on subsequent runs unless
 *      `--refresh` is passed.
 *   2. Scans every row and keeps the ones that pass the NATIONAL
 *      ELIGIBILITY FILTER below — no manually maintained institution list.
 *   3. Normalizes the kept rows into our internal `College` schema
 *      (src/lib/types.ts), generating a stable slug per institution.
 *   4. Validates the normalized data and resolves any slug collisions
 *      deterministically.
 *   5. Writes `src/data/generated/colleges.json` (committed) and a
 *      human-readable import report — but NEVER if the result looks
 *      empty/broken (see the safeguard below).
 *
 * Data source: US Dept of Education College Scorecard, "Most Recent
 * Institution-Level Data" bulk CSV. Source page:
 * https://collegescorecard.ed.gov/data/ (exact download URL is
 * discovered from that page since the filename is date-stamped; override
 * with COLLEGE_SCORECARD_ZIP_URL if discovery ever breaks).
 *
 * ---------------------------------------------------------------------
 * NATIONAL ELIGIBILITY FILTER — every column below is an official,
 * documented College Scorecard field (data dictionary at
 * https://collegescorecard.ed.gov/data/documentation/). Nothing here is
 * guessed. This filter was revised after an evidence-based audit (see
 * import-report.txt and the audit notes below) that compared it against
 * three alternatives on the real data before changing anything.
 *
 *   CURROPER == 1        Currently operating institution (excludes closed
 *                        schools).
 *   PREDDEG == 3         "Predominantly bachelor's-degree granting." Chosen
 *                        over the seemingly-more-obvious `ICLEVEL == 1`
 *                        ("four-year institution" level code) because
 *                        ICLEVEL has real coverage gaps in this dataset —
 *                        it's NA for Harvey Mudd College, University of
 *                        Denver, Trinity College (CT), and Western
 *                        Connecticut State University, among others.
 *                        Filtering on ICLEVEL would have silently dropped
 *                        well-known legitimate universities. PREDDEG==3 is
 *                        well-populated and directly captures "four-year,
 *                        bachelor's-oriented, undergraduate degree-granting"
 *                        in one documented step.
 *   UGDS >= 50            Undergraduate enrollment floor — "a meaningful
 *                        physical undergraduate campus" per the brief.
 *                        AUDIT FINDING: the previous filter required
 *                        MAIN == 1 (main campus, not a branch) instead of
 *                        this. That was backwards — it excluded large,
 *                        clearly legitimate regional campuses (Rutgers
 *                        University-Newark: 7,709 undergrads; Rutgers
 *                        University-Camden: 3,753; Penn State Erie-Behrend:
 *                        3,240) simply because IPEDS books them as
 *                        secondary campuses in a multi-campus system, while
 *                        still including single-digit-enrollment seminaries
 *                        (Saint John's Seminary: 7 students; Adler
 *                        University: 9) that happened to be flagged "main."
 *                        Enrollment size is a far more honest signal of
 *                        "meaningful physical undergraduate campus" than an
 *                        administrative main-campus flag. Net effect of
 *                        this change: +145 legitimate campuses added,
 *                        -57 near-zero-enrollment seminaries/Bible
 *                        colleges/specialty schools removed (1,733 -> 1,821).
 *   DISTANCEONLY != 1    Scorecard's own flag for "distance-education-only"
 *                        institutions — used to exclude online-only
 *                        schools from a geographic exploration product.
 *   CONTROL in {1,2,3}   Public / private nonprofit / private for-profit —
 *                        all three ownership types are kept. No separate
 *                        for-profit-specific carve-out is applied: the
 *                        PREDDEG==3 + UGDS>=50 requirements above already
 *                        exclude the vocational/certificate-style for-profit
 *                        schools that wouldn't fit undergraduate college
 *                        exploration, without inventing a second,
 *                        less-documented heuristic aimed only at for-profits.
 *   Valid LATITUDE/LONGITUDE   Must be present and within valid ranges.
 * ---------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync, existsSync, createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import readline from "node:readline";
import AdmZip from "adm-zip";
import type { College, Ownership } from "../src/lib/types.ts";
import {
  slugify,
  loadRegistry,
  saveRegistry,
  loadRedirects,
  validateRedirects,
  resolveSlug,
  type StableSlugRegistry,
} from "./lib/stable-slugs.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RAW_DIR = resolve(ROOT, "src/data/raw");
const ZIP_CACHE_PATH = resolve(RAW_DIR, "college-scorecard-institution.zip");
const CSV_CACHE_PATH = resolve(RAW_DIR, "Most-Recent-Cohorts-Institution.csv");
const OUTPUT_PATH = resolve(ROOT, "src/data/generated/colleges.json");
const REPORT_PATH = resolve(ROOT, "src/data/generated/import-report.txt");
const REGISTRY_PATH = resolve(ROOT, "src/data/curated/stable-slugs.json");
const REDIRECTS_PATH = resolve(ROOT, "src/data/curated/slug-redirects.json");
const REDIRECTS_OUTPUT_PATH = resolve(ROOT, "public/_redirects");

const DATA_PAGE_URL = "https://collegescorecard.ed.gov/data/";
const ZIP_LINK_PATTERN = /https:\/\/[^\s"'<>]+Most-Recent-Cohorts-Institution[^\s"'<>]*\.zip/i;
const CSV_ENTRY_PATTERN = /Most-Recent-Cohorts-Institution\.csv$/i;

const forceRefresh = process.argv.includes("--refresh");

/**
 * Safeguard: a successful national import should yield thousands of
 * institutions. If a run produces fewer than this, something is wrong
 * (bad filter, truncated CSV, network hiccup) — refuse to overwrite the
 * last known-good `colleges.json` rather than silently shipping an
 * empty/tiny dataset. This is also how we avoid repeating what likely
 * happened previously: a generated file getting committed while empty.
 */
const MIN_EXPECTED_INSTITUTIONS = 500;

const CSV_COLUMNS = [
  "UNITID", "INSTNM", "CITY", "STABBR", "ZIP", "INSTURL", "CONTROL", "LOCALE",
  "LATITUDE", "LONGITUDE", "ADM_RATE", "SAT_AVG", "UGDS", "TUITIONFEE_IN",
  "TUITIONFEE_OUT", "NPT4_PUB", "NPT4_PRIV", "C150_4", "MD_EARN_WNE_P10",
  "CURROPER", "PREDDEG", "DISTANCEONLY",
] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];
export type RawRow = Record<CsvColumn, string | undefined>;

const MISSING_TOKENS = new Set(["", "NA", "NULL", "PRIVACYSUPPRESSED"]);

const STATE_NAME_BY_CODE: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa",
  MP: "Northern Mariana Islands", FM: "Micronesia", PW: "Palau", MH: "Marshall Islands",
};

// Editorial "featured" flag — a handful of well-known institutions,
// carried forward from the original prototype dataset. Not an official
// Scorecard field. Keyed by UNITID (not slug/name) since it's an identity
// flag and identity is UNITID, per the stable-URL architecture below.
// Can be overridden per-college via CuratedCollegeData.featured without
// re-running the importer.
const FEATURED_UNIT_IDS = new Set([
  "110662", // University of California-Los Angeles
  "110635", // University of California-Berkeley
  "243744", // Stanford University
  "166027", // Harvard University
  "170976", // University of Michigan-Ann Arbor
]);

type Report = {
  totalRawRows: number;
  passedFilter: number;
  excluded: number;
  ownership: { public: number; privateNonprofit: number; privateForProfit: number; unknown: number };
  imported: number;
  validationErrors: { slug: string; reason: string }[];
  missing: {
    admissionRate: number;
    sat: number;
    netPrice: number;
    graduationRate: number;
    tuition: number;
    coordinates: number;
    earnings: number;
  };
  duplicateUnitIds: string[];
  duplicateSlugs: string[];
  invalidCoordinates: number;
  existingSlugsReused: number;
  newSlugsAssigned: number;
  slugCollisionsEncountered: number;
  historicalRegistryEntriesNotInCurrentDataset: number;
  redirectsPreserved: number;
};

// ---------------------------------------------------------------------------
// Download + cache (unchanged from the 20-college version)
// ---------------------------------------------------------------------------

async function resolveZipUrl(): Promise<string> {
  const override = process.env.COLLEGE_SCORECARD_ZIP_URL;
  if (override) {
    console.log(`[data:import] Using COLLEGE_SCORECARD_ZIP_URL override: ${override}`);
    return override;
  }
  console.log(`[data:import] Looking up current download link on ${DATA_PAGE_URL} ...`);
  const res = await fetch(DATA_PAGE_URL);
  if (!res.ok) {
    throw new Error(`Failed to load College Scorecard data page: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const match = html.match(ZIP_LINK_PATTERN);
  if (!match) {
    throw new Error(
      "Could not find the 'Most-Recent-Cohorts-Institution' ZIP link on the College Scorecard " +
        "data page — its structure may have changed. Set COLLEGE_SCORECARD_ZIP_URL to override."
    );
  }
  return match[0];
}

async function ensureCsv(): Promise<string> {
  mkdirSync(RAW_DIR, { recursive: true });

  if (!forceRefresh && existsSync(CSV_CACHE_PATH)) {
    console.log(`[data:import] Reusing cached CSV: ${CSV_CACHE_PATH} (pass --refresh to redownload)`);
    return CSV_CACHE_PATH;
  }

  if (!forceRefresh && existsSync(ZIP_CACHE_PATH)) {
    console.log(`[data:import] Reusing cached ZIP: ${ZIP_CACHE_PATH} (pass --refresh to redownload)`);
  } else {
    const zipUrl = await resolveZipUrl();
    console.log(`[data:import] Downloading ${zipUrl} ...`);
    const res = await fetch(zipUrl);
    if (!res.ok) {
      throw new Error(`Failed to download College Scorecard ZIP: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(ZIP_CACHE_PATH, buffer);
    console.log(`[data:import] Saved ${(buffer.length / 1e6).toFixed(1)} MB to ${ZIP_CACHE_PATH}`);
  }

  console.log("[data:import] Extracting institution CSV from ZIP...");
  const zip = new AdmZip(ZIP_CACHE_PATH);
  const entry = zip.getEntries().find((e) => CSV_ENTRY_PATTERN.test(e.entryName));
  if (!entry) {
    throw new Error("Could not find Most-Recent-Cohorts-Institution.csv inside the downloaded ZIP.");
  }
  writeFileSync(CSV_CACHE_PATH, entry.getData());
  return CSV_CACHE_PATH;
}

// ---------------------------------------------------------------------------
// Filter + normalize
// ---------------------------------------------------------------------------

function extractRow(fields: string[], idx: Record<CsvColumn, number>): RawRow {
  const row = {} as RawRow;
  for (const col of CSV_COLUMNS) row[col] = fields[idx[col]];
  return row;
}

export function parseNumeric(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (MISSING_TOKENS.has(trimmed.toUpperCase())) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/** The national eligibility filter described in the file header comment. */
const MIN_UNDERGRAD_ENROLLMENT = 50;

export function isEligible(row: RawRow): boolean {
  const curroper = parseNumeric(row.CURROPER);
  const preddeg = parseNumeric(row.PREDDEG);
  const ugds = parseNumeric(row.UGDS);
  const distanceOnly = parseNumeric(row.DISTANCEONLY);
  const control = parseNumeric(row.CONTROL);
  const lat = parseNumeric(row.LATITUDE);
  const lon = parseNumeric(row.LONGITUDE);

  if (curroper !== 1) return false;
  if (preddeg !== 3) return false;
  if ((ugds ?? 0) < MIN_UNDERGRAD_ENROLLMENT) return false;
  if (distanceOnly === 1) return false;
  if (control !== 1 && control !== 2 && control !== 3) return false;
  if (lat === undefined || lon === undefined) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;

  return true;
}

function mapOwnership(code: number | undefined): Ownership | undefined {
  switch (code) {
    case 1: return "public";
    case 2: return "private-nonprofit";
    case 3: return "private-for-profit";
    default: return undefined;
  }
}

/**
 * NCES urban-centric locale codes: 11-13 City, 21-23 Suburb, 31-33 Town,
 * 41-43 Rural. Bucketed into our simpler campusSetting categories.
 */
function mapCampusSetting(code: number | undefined): string | undefined {
  if (code === undefined) return undefined;
  if (code >= 11 && code <= 13) return "urban";
  if (code >= 21 && code <= 23) return "suburban";
  if (code >= 31 && code <= 33) return "college-town";
  if (code >= 41 && code <= 43) return "rural";
  return undefined;
}

function normalizeWebsite(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
}

function normalize(row: RawRow, slug: string): College {
  const stateCode = (row.STABBR ?? "").toUpperCase();
  const control = parseNumeric(row.CONTROL);
  const netPrice = control === 1 ? parseNumeric(row.NPT4_PUB) : parseNumeric(row.NPT4_PRIV);

  return {
    id: slug,
    unitId: row.UNITID ?? "",
    slug,
    name: row.INSTNM ?? "",
    city: row.CITY ?? "",
    state: STATE_NAME_BY_CODE[stateCode] ?? stateCode,
    stateCode,
    zip: row.ZIP || undefined,
    latitude: parseNumeric(row.LATITUDE) ?? NaN,
    longitude: parseNumeric(row.LONGITUDE) ?? NaN,
    ownership: mapOwnership(control),
    undergraduateEnrollment: parseNumeric(row.UGDS),
    admissionRate: parseNumeric(row.ADM_RATE),
    tuitionInState: parseNumeric(row.TUITIONFEE_IN),
    tuitionOutOfState: parseNumeric(row.TUITIONFEE_OUT),
    averageNetPrice: netPrice,
    graduationRate: parseNumeric(row.C150_4),
    medianEarnings: parseNumeric(row.MD_EARN_WNE_P10),
    satAverage: parseNumeric(row.SAT_AVG),
    campusSetting: mapCampusSetting(parseNumeric(row.LOCALE)),
    website: normalizeWebsite(row.INSTURL),
    featured: FEATURED_UNIT_IDS.has(row.UNITID ?? ""),
  };
}

function validate(college: College, report: Report): boolean {
  let ok = true;
  const fail = (reason: string) => {
    report.validationErrors.push({ slug: college.slug, reason });
    ok = false;
  };

  if (!college.name || college.name.trim().length === 0) fail("missing institution name");
  if (!college.stateCode) fail("missing state");

  if (Number.isNaN(college.latitude) || Number.isNaN(college.longitude)) {
    report.missing.coordinates += 1;
    fail("missing coordinates");
  } else {
    if (college.latitude < -90 || college.latitude > 90) {
      report.invalidCoordinates += 1;
      fail(`invalid latitude ${college.latitude}`);
    }
    if (college.longitude < -180 || college.longitude > 180) {
      report.invalidCoordinates += 1;
      fail(`invalid longitude ${college.longitude}`);
    }
  }

  if (college.admissionRate !== undefined && (college.admissionRate < 0 || college.admissionRate > 1)) {
    fail(`impossible admission rate ${college.admissionRate}`);
  }
  if (college.tuitionInState !== undefined && college.tuitionInState < 0) fail("negative in-state tuition");
  if (college.tuitionOutOfState !== undefined && college.tuitionOutOfState < 0) fail("negative out-of-state tuition");

  if (college.admissionRate === undefined) report.missing.admissionRate += 1;
  if (college.satAverage === undefined) report.missing.sat += 1;
  if (college.averageNetPrice === undefined) report.missing.netPrice += 1;
  if (college.graduationRate === undefined) report.missing.graduationRate += 1;
  if (college.tuitionInState === undefined && college.tuitionOutOfState === undefined) report.missing.tuition += 1;
  if (college.medianEarnings === undefined) report.missing.earnings += 1;

  return ok;
}

function formatReport(report: Report): string {
  const lines = [
    "College Scorecard national import complete",
    "",
    `Total raw Scorecard rows: ${report.totalRawRows}`,
    `Rows passing eligibility filter: ${report.passedFilter}`,
    `Rows excluded: ${report.excluded}`,
    "",
    `Public: ${report.ownership.public}`,
    `Private nonprofit: ${report.ownership.privateNonprofit}`,
    `Private for-profit: ${report.ownership.privateForProfit}`,
    `Unknown ownership: ${report.ownership.unknown}`,
    "",
    `Imported (after validation): ${report.imported}`,
    "",
    `Missing admission rate: ${report.missing.admissionRate}`,
    `Missing SAT data: ${report.missing.sat}`,
    `Missing net price: ${report.missing.netPrice}`,
    `Missing graduation rate: ${report.missing.graduationRate}`,
    `Missing tuition: ${report.missing.tuition}`,
    `Missing median earnings: ${report.missing.earnings}`,
    `Missing coordinates: ${report.missing.coordinates}`,
    "",
    `Duplicate UNITIDs: ${report.duplicateUnitIds.length}${report.duplicateUnitIds.length ? " (" + report.duplicateUnitIds.slice(0, 10).join(", ") + (report.duplicateUnitIds.length > 10 ? ", ..." : "") + ")" : ""}`,
    `Duplicate slugs: ${report.duplicateSlugs.length}`,
    `Invalid coordinates: ${report.invalidCoordinates}`,
    "",
    "-- Stable slug registry --",
    `Existing stable slugs reused: ${report.existingSlugsReused}`,
    `New slugs assigned: ${report.newSlugsAssigned}`,
    `Slug collisions encountered: ${report.slugCollisionsEncountered}`,
    `Historical registry entries not in current dataset: ${report.historicalRegistryEntriesNotInCurrentDataset}`,
    `Redirects preserved: ${report.redirectsPreserved}`,
    "",
    `Validation errors: ${report.validationErrors.length}`,
    ...report.validationErrors.slice(0, 20).map((e) => `  - ${e.slug}: ${e.reason}`),
    ...(report.validationErrors.length > 20 ? [`  ... and ${report.validationErrors.length - 20} more`] : []),
  ];
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const report: Report = {
    totalRawRows: 0,
    passedFilter: 0,
    excluded: 0,
    ownership: { public: 0, privateNonprofit: 0, privateForProfit: 0, unknown: 0 },
    imported: 0,
    validationErrors: [],
    missing: { admissionRate: 0, sat: 0, netPrice: 0, graduationRate: 0, tuition: 0, coordinates: 0, earnings: 0 },
    duplicateUnitIds: [],
    duplicateSlugs: [],
    invalidCoordinates: 0,
    existingSlugsReused: 0,
    newSlugsAssigned: 0,
    slugCollisionsEncountered: 0,
    historicalRegistryEntriesNotInCurrentDataset: 0,
    redirectsPreserved: 0,
  };

  const csvPath = await ensureCsv();
  console.log("[data:import] Scanning CSV and applying national eligibility filter...");

  const eligibleRows: RawRow[] = [];
  const rl = readline.createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
  let idx: Record<CsvColumn, number> | null = null;

  for await (const line of rl) {
    if (!idx) {
      const header = line.split(",");
      idx = {} as Record<CsvColumn, number>;
      for (const col of CSV_COLUMNS) idx[col] = header.indexOf(col);
      const missingCols = CSV_COLUMNS.filter((c) => idx![c] === -1);
      if (missingCols.length > 0) {
        throw new Error(`CSV is missing expected column(s): ${missingCols.join(", ")}`);
      }
      continue;
    }
    if (!line.trim()) continue;
    report.totalRawRows += 1;

    const fields = line.split(",");
    const row = extractRow(fields, idx);
    if (isEligible(row)) {
      eligibleRows.push(row);
    }
  }

  report.passedFilter = eligibleRows.length;
  report.excluded = report.totalRawRows - report.passedFilter;

  // --- Stable slug resolution -------------------------------------------
  // UNITID is the permanent identity; slug is a persisted property of it.
  // An institution that already has a registry entry ALWAYS keeps that
  // slug, no matter what its current official name is.
  const registryBefore = loadRegistry(REGISTRY_PATH);
  const registrySnapshot: StableSlugRegistry = { ...registryBefore };
  const registry: StableSlugRegistry = { ...registryBefore };
  const claimedSlugs = new Set(Object.values(registry));
  const colleges: College[] = [];

  for (const row of eligibleRows) {
    const unitId = row.UNITID ?? "";
    const before = registry[unitId];
    const hadExistingSlug = before !== undefined;
    const baseSlug = slugify(row.INSTNM ?? "");

    const { slug, isNew } = resolveSlug({
      unitId,
      name: row.INSTNM ?? "",
      city: row.CITY ?? "",
      stateCode: row.STABBR ?? "",
      registry,
      claimedSlugs,
    });

    // --- Change-detection safeguard: never silently move a public URL ---
    if (hadExistingSlug && before !== slug) {
      throw new Error(
        `ERROR:\nStable slug changed for UNITID ${unitId}\n\nOld:\n${before}\n\nAttempted:\n${slug}\n\n` +
          "Existing public URLs must not be silently changed. If this change is intentional, " +
          "edit src/data/curated/stable-slugs.json by hand and add a redirect entry in " +
          "src/data/curated/slug-redirects.json, then re-run the import."
      );
    }

    if (isNew) {
      registry[unitId] = slug;
      claimedSlugs.add(slug);
      report.newSlugsAssigned += 1;
      if (slug !== baseSlug) report.slugCollisionsEncountered += 1;
    } else {
      report.existingSlugsReused += 1;
    }

    const college = normalize(row, slug);

    switch (college.ownership) {
      case "public": report.ownership.public += 1; break;
      case "private-nonprofit": report.ownership.privateNonprofit += 1; break;
      case "private-for-profit": report.ownership.privateForProfit += 1; break;
      default: report.ownership.unknown += 1;
    }

    if (validate(college, report)) {
      colleges.push(college);
    }
  }

  const unitIdCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  for (const c of colleges) {
    unitIdCounts.set(c.unitId, (unitIdCounts.get(c.unitId) ?? 0) + 1);
    slugCounts.set(c.slug, (slugCounts.get(c.slug) ?? 0) + 1);
  }
  report.duplicateUnitIds = [...unitIdCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  report.duplicateSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([slug]) => slug);

  colleges.sort((a, b) => a.stateCode.localeCompare(b.stateCode) || a.name.localeCompare(b.name));
  report.imported = colleges.length;

  // --- Safeguard: never let a broken/empty run clobber a good dataset. ---
  if (colleges.length < MIN_EXPECTED_INSTITUTIONS) {
    console.error(
      `[data:import] Only ${colleges.length} institutions passed (expected at least ${MIN_EXPECTED_INSTITUTIONS}). ` +
        "Refusing to overwrite the existing colleges.json — leaving it untouched."
    );
    writeFileSync(REPORT_PATH, formatReport(report));
    process.exitCode = 1;
    return;
  }

  // Historical registry entries (institutions that were assigned a slug in
  // the past but no longer pass the current eligibility filter) are kept
  // forever — never deleted, never recycled to a different UNITID.
  const currentUnitIds = new Set(colleges.map((c) => c.unitId));
  report.historicalRegistryEntriesNotInCurrentDataset = Object.keys(registry).filter(
    (unitId) => !currentUnitIds.has(unitId)
  ).length;

  // Only touch the registry file if it actually changed — keeps output
  // deterministic and avoids noisy diffs on every run.
  const registryChanged = JSON.stringify(registry) !== JSON.stringify(registrySnapshot);
  if (registryChanged) {
    saveRegistry(REGISTRY_PATH, registry);
    console.log(`[data:import] Stable slug registry updated (+${report.newSlugsAssigned} new entries).`);
  }

  // Redirects are curated by hand (e.g. after an intentional slug change),
  // never auto-generated from thin air — but every run validates them
  // against the final registry and regenerates the Cloudflare Pages
  // _redirects file that serves them.
  const redirects = loadRedirects(REDIRECTS_PATH);
  const redirectErrors = validateRedirects(redirects, registry);
  if (redirectErrors.length > 0) {
    throw new Error(`Invalid slug redirects in src/data/curated/slug-redirects.json:\n` + redirectErrors.map((e) => `  - ${e}`).join("\n"));
  }
  report.redirectsPreserved = Object.keys(redirects).length;
  const redirectsFileContent =
    Object.entries(redirects)
      .map(([from, to]) => `/college/${from} /college/${to} 301`)
      .join("\n") + (Object.keys(redirects).length > 0 ? "\n" : "");
  writeFileSync(REDIRECTS_OUTPUT_PATH, redirectsFileContent);

  mkdirSync(resolve(ROOT, "src/data/generated"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(colleges, null, 2) + "\n");

  const reportText = formatReport(report);
  writeFileSync(REPORT_PATH, reportText);
  console.log("\n" + reportText);

  if (report.validationErrors.length > 0) {
    console.error(`[data:import] Completed with ${report.validationErrors.length} validation error(s). See report above.`);
    process.exitCode = 1;
  }
}

// Guard so this module can be imported by tests (for the pure functions
// exported above) without triggering a real download/import run. Vitest
// sets process.env.VITEST automatically.
if (!process.env.VITEST) {
  main().catch((err) => {
    console.error("[data:import] Fatal error:", err);
    process.exitCode = 1;
  });
}
