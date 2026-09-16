/**
 * College Scorecard bulk-download import pipeline.
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
 *   2. For each institution in `institution-manifest.ts`, scans the CSV for
 *      matching rows by name/city/state and verifies a confident, unique
 *      match before accepting it — it never just accepts "the
 *      closest-sounding name."
 *   3. Normalizes the verified official fields into our internal `College`
 *      schema (src/lib/types.ts).
 *   4. Validates the normalized data (coordinates, rates, tuition, URLs,
 *      duplicate IDs/slugs).
 *   5. Writes `src/data/generated/colleges.json` (committed — this is the
 *      data our static build actually consumes) and a human-readable
 *      import report.
 *
 * Data source: US Dept of Education College Scorecard, "Most Recent
 * Institution-Level Data" bulk CSV.
 * Source page: https://collegescorecard.ed.gov/data/
 * The exact download URL is discovered by reading that page (the file name
 * is date-stamped and changes each time ED refreshes the data) — override
 * with COLLEGE_SCORECARD_ZIP_URL if that page's structure ever changes and
 * discovery breaks.
 *
 * This script only ever runs locally/at build time and needs no
 * credentials — the bulk file is public.
 */
import { writeFileSync, mkdirSync, existsSync, createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import readline from "node:readline";
import AdmZip from "adm-zip";
import { institutionManifest, type ManifestEntry } from "./institution-manifest.ts";
import type { College, Ownership } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RAW_DIR = resolve(ROOT, "src/data/raw");
const ZIP_CACHE_PATH = resolve(RAW_DIR, "college-scorecard-institution.zip");
const CSV_CACHE_PATH = resolve(RAW_DIR, "Most-Recent-Cohorts-Institution.csv");

const DATA_PAGE_URL = "https://collegescorecard.ed.gov/data/";
const ZIP_LINK_PATTERN = /https:\/\/[^\s"'<>]+Most-Recent-Cohorts-Institution[^\s"'<>]*\.zip/i;
const CSV_ENTRY_PATTERN = /Most-Recent-Cohorts-Institution\.csv$/i;

const forceRefresh = process.argv.includes("--refresh");

/**
 * Exact College Scorecard bulk-CSV columns this pipeline reads, and why.
 * Every internal `College` field populated from the data traces back to
 * exactly one of these — nothing here is inferred or guessed.
 *
 *   UNITID           -> unitId (canonical IPEDS/Scorecard identifier)
 *   INSTNM           -> name
 *   CITY             -> city
 *   STABBR           -> stateCode
 *   ZIP              -> zip
 *   INSTURL          -> website
 *   CONTROL          -> ownership (1=public, 2=private nonprofit, 3=private for-profit)
 *   LOCALE           -> campusSetting (NCES urban-centric locale code, bucketed)
 *   LATITUDE / LONGITUDE -> latitude / longitude
 *   UGDS             -> undergraduateEnrollment (degree/certificate-seeking undergrads)
 *   ADM_RATE         -> admissionRate
 *   TUITIONFEE_IN    -> tuitionInState
 *   TUITIONFEE_OUT   -> tuitionOutOfState
 *   NPT4_PUB / NPT4_PRIV -> averageNetPrice (PUB when CONTROL=1, otherwise PRIV — the
 *                        two fields are mutually exclusive per institution in this dataset)
 *   C150_4           -> graduationRate (first-time, full-time students at 4-year
 *                        institutions, 150% of expected completion time — the figure
 *                        shown as "Graduation Rate" on the public collegescorecard.ed.gov site)
 *   SAT_AVG          -> satAverage
 *   MD_EARN_WNE_P10  -> medianEarnings (median earnings of former students working and
 *                        not enrolled, 10 years after entry — the headline Scorecard
 *                        earnings metric)
 *
 * Deliberately NOT mapped: no substitute column is used when one of these
 * is missing. A missing value stays undefined and renders as "Data
 * unavailable" in the UI — never a different-but-similar-sounding column.
 */
const CSV_COLUMNS = [
  "UNITID", "INSTNM", "CITY", "STABBR", "ZIP", "INSTURL", "CONTROL", "LOCALE",
  "LATITUDE", "LONGITUDE", "ADM_RATE", "SAT_AVG", "UGDS", "TUITIONFEE_IN",
  "TUITIONFEE_OUT", "NPT4_PUB", "NPT4_PRIV", "C150_4", "MD_EARN_WNE_P10",
] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];
type RawRow = Record<CsvColumn, string | undefined>;

// The bulk CSV represents missing/suppressed values with these tokens
// (only "NA" appears in the current vintage; the others are defensive
// against future format drift).
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
};

// Editorial "featured" flag, carried forward from the original prototype
// dataset. Not an official Scorecard field — a lightweight curation
// choice baked into the base record. Can be overridden per-college via
// CuratedCollegeData.featured without re-running the importer.
const FEATURED_SLUGS = new Set([
  "university-of-california-los-angeles",
  "university-of-california-berkeley",
  "stanford-university",
  "harvard-university",
  "university-of-michigan",
]);

type Report = {
  requested: number;
  imported: number;
  matchFailures: { slug: string; reason: string }[];
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
};

// ---------------------------------------------------------------------------
// Download + cache
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

/** Ensures the institution CSV exists locally, downloading/extracting only if needed. */
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
// Matching
// ---------------------------------------------------------------------------

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function namesLooselyMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function extractRow(fields: string[], idx: Record<CsvColumn, number>): RawRow {
  const row = {} as RawRow;
  for (const col of CSV_COLUMNS) row[col] = fields[idx[col]];
  return row;
}

/** Single streaming pass over the CSV, collecting match candidates for every manifest entry at once. */
async function collectCandidates(csvPath: string): Promise<Map<string, RawRow[]>> {
  const candidates = new Map<string, RawRow[]>();
  for (const entry of institutionManifest) candidates.set(entry.slug, []);

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

    const fields = line.split(",");
    const unitId = fields[idx.UNITID];
    const instnm = fields[idx.INSTNM] ?? "";
    const stabbr = (fields[idx.STABBR] ?? "").toUpperCase();

    for (const entry of institutionManifest) {
      const isKnownIdMatch = entry.knownUnitId !== undefined && unitId === String(entry.knownUnitId);
      const isNameStateMatch =
        stabbr === entry.expectedState.toUpperCase() && namesLooselyMatch(instnm, entry.searchName);
      if (isKnownIdMatch || isNameStateMatch) {
        candidates.get(entry.slug)!.push(extractRow(fields, idx));
      }
    }
  }

  return candidates;
}

/** Picks the single confident match for one entry, or throws. */
function resolveEntry(entry: ManifestEntry, candidates: RawRow[]): RawRow {
  if (candidates.length === 0) {
    throw new Error(`no CSV rows matched "${entry.searchName}" in ${entry.expectedState}`);
  }
  if (candidates.length === 1) return candidates[0];

  // Prefer an exact name match over a substring match (e.g. "University of
  // Florida" vs. "Baptist University of Florida" / "University of
  // Florida-Online", which would otherwise both substring-match too).
  const exactNameMatches = candidates.filter((c) => normName(c.INSTNM ?? "") === normName(entry.searchName));
  if (exactNameMatches.length === 1) return exactNameMatches[0];

  const pool = exactNameMatches.length > 1 ? exactNameMatches : candidates;
  const cityMatches = pool.filter((c) => namesLooselyMatch(c.CITY ?? "", entry.expectedCity));
  if (cityMatches.length === 1) return cityMatches[0];

  const summary = candidates
    .map((c) => `UNITID=${c.UNITID} "${c.INSTNM}" (${c.CITY}, ${c.STABBR})`)
    .join("; ");
  throw new Error(
    `could not confidently match "${entry.searchName}" in ${entry.expectedCity}, ${entry.expectedState} — candidates: ${summary}`
  );
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

function parseNumeric(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (MISSING_TOKENS.has(trimmed.toUpperCase())) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
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

function normalize(entry: ManifestEntry, raw: RawRow): College {
  const stateCode = (raw.STABBR ?? "").toUpperCase();
  const control = parseNumeric(raw.CONTROL);
  const netPrice = control === 1 ? parseNumeric(raw.NPT4_PUB) : parseNumeric(raw.NPT4_PRIV);

  return {
    id: entry.slug,
    unitId: raw.UNITID ?? "",
    slug: entry.slug,
    name: raw.INSTNM || entry.searchName,
    city: raw.CITY || entry.expectedCity,
    state: STATE_NAME_BY_CODE[stateCode] ?? stateCode,
    stateCode,
    zip: raw.ZIP || undefined,
    latitude: parseNumeric(raw.LATITUDE) ?? NaN,
    longitude: parseNumeric(raw.LONGITUDE) ?? NaN,
    ownership: mapOwnership(control),
    undergraduateEnrollment: parseNumeric(raw.UGDS),
    admissionRate: parseNumeric(raw.ADM_RATE),
    tuitionInState: parseNumeric(raw.TUITIONFEE_IN),
    tuitionOutOfState: parseNumeric(raw.TUITIONFEE_OUT),
    averageNetPrice: netPrice,
    graduationRate: parseNumeric(raw.C150_4),
    medianEarnings: parseNumeric(raw.MD_EARN_WNE_P10),
    satAverage: parseNumeric(raw.SAT_AVG),
    campusSetting: mapCampusSetting(parseNumeric(raw.LOCALE)),
    website: normalizeWebsite(raw.INSTURL),
    featured: FEATURED_SLUGS.has(entry.slug),
  };
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

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

  // Informational (non-fatal) missing-field counters
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
    "College Scorecard import complete",
    "",
    `Requested institutions: ${report.requested}`,
    `Imported: ${report.imported}`,
    "",
    `Missing admission rate: ${report.missing.admissionRate}`,
    `Missing SAT data: ${report.missing.sat}`,
    `Missing net price: ${report.missing.netPrice}`,
    `Missing graduation rate: ${report.missing.graduationRate}`,
    `Missing tuition: ${report.missing.tuition}`,
    `Missing median earnings: ${report.missing.earnings}`,
    `Missing coordinates: ${report.missing.coordinates}`,
    "",
    `Duplicate UNITIDs: ${report.duplicateUnitIds.length}${report.duplicateUnitIds.length ? " (" + report.duplicateUnitIds.join(", ") + ")" : ""}`,
    `Duplicate slugs: ${report.duplicateSlugs.length}${report.duplicateSlugs.length ? " (" + report.duplicateSlugs.join(", ") + ")" : ""}`,
    `Invalid coordinates: ${report.invalidCoordinates}`,
    `Match failures: ${report.matchFailures.length}`,
    ...report.matchFailures.map((f) => `  - ${f.slug}: ${f.reason}`),
    `Validation errors: ${report.validationErrors.length}`,
    ...report.validationErrors.map((e) => `  - ${e.slug}: ${e.reason}`),
  ];
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const report: Report = {
    requested: institutionManifest.length,
    imported: 0,
    matchFailures: [],
    validationErrors: [],
    missing: { admissionRate: 0, sat: 0, netPrice: 0, graduationRate: 0, tuition: 0, coordinates: 0, earnings: 0 },
    duplicateUnitIds: [],
    duplicateSlugs: [],
    invalidCoordinates: 0,
  };

  const csvPath = await ensureCsv();
  console.log("[data:import] Scanning CSV for target institutions...");
  const candidatesBySlug = await collectCandidates(csvPath);

  const resolved: { entry: ManifestEntry; raw: RawRow }[] = [];
  for (const entry of institutionManifest) {
    try {
      const raw = resolveEntry(entry, candidatesBySlug.get(entry.slug) ?? []);
      resolved.push({ entry, raw });
      console.log(`[data:import] resolved ${entry.slug} -> UNITID=${raw.UNITID} "${raw.INSTNM}"`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      report.matchFailures.push({ slug: entry.slug, reason });
      console.error(`[data:import] FAILED to resolve ${entry.slug}: ${reason}`);
    }
  }

  const colleges: College[] = [];
  for (const { entry, raw } of resolved) {
    const college = normalize(entry, raw);
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

  const deduped = colleges.filter((c, i) => colleges.findIndex((o) => o.slug === c.slug) === i);
  deduped.sort((a, b) => a.stateCode.localeCompare(b.stateCode) || a.name.localeCompare(b.name));

  report.imported = deduped.length;

  const outputPath = resolve(ROOT, "src/data/generated/colleges.json");
  if (deduped.length === 0) {
    console.error(
      "[data:import] 0 institutions imported — refusing to overwrite an existing colleges.json with an empty dataset."
    );
    process.exitCode = 1;
  } else {
    mkdirSync(resolve(ROOT, "src/data/generated"), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(deduped, null, 2) + "\n");
  }

  const reportText = formatReport(report);
  writeFileSync(resolve(ROOT, "src/data/generated/import-report.txt"), reportText);
  console.log("\n" + reportText);

  const hasHardFailures = report.matchFailures.length > 0 || report.validationErrors.length > 0;
  if (hasHardFailures) {
    console.error(
      `[data:import] Completed with ${report.matchFailures.length} match failure(s) and ${report.validationErrors.length} validation error(s). See report above.`
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[data:import] Fatal error:", err);
  process.exitCode = 1;
});
