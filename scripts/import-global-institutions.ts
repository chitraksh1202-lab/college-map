/**
 * Global (non-US) institution import pipeline.
 *
 * Run with: npm run data:import:global
 * Force a fresh download: npm run data:import:global -- --refresh
 *
 * What this does:
 *   1. Downloads the official ROR (Research Organization Registry) data
 *      dump ZIP from Zenodo (community "ror-data") — the reproducible
 *      bulk file ROR itself publishes, not a live paginated API call.
 *      Caches the ZIP and the extracted ~300MB JSON under
 *      `src/data/raw/ror/` (gitignored) and reuses that cache on
 *      subsequent runs unless `--refresh` is passed.
 *   2. Streams the JSON array (stream-json — the file is far too large to
 *      safely `JSON.parse` whole) and applies the eligibility pipeline in
 *      scripts/lib/global-institutions.ts, recording diagnostic counts at
 *      every stage.
 *   3. Assigns each eligible institution a stable slug via the SAME
 *      registry/resolution logic as the US pipeline
 *      (scripts/lib/stable-slugs.ts) — extended, not replaced.
 *   4. Writes `src/data/generated/global-institutions.json` (committed)
 *      and a diagnostic report.
 *
 * US institutions are never sourced from here — see
 * scripts/merge-global-dataset.ts for how the two sources combine and why
 * ROR's own US records are deliberately excluded (Phase 3/8: College
 * Scorecard remains sole US authority; see isNonUS below).
 */
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import AdmZip from "adm-zip";
import streamChainPkg from "stream-chain";
import streamJsonPkg from "stream-json";
import streamArrayPkg from "stream-json/streamers/StreamArray.js";

const { chain } = streamChainPkg;
const { parser } = streamJsonPkg;
const { streamArray } = streamArrayPkg;
import {
  isActiveEducation,
  hasValidLocation,
  isNonUS,
  passesK12Filter,
  hasWebsite,
  isEligibleGlobalInstitution,
  normalizeGlobalInstitution,
  type RorRecord,
} from "./lib/global-institutions.ts";
import {
  loadRegistry,
  saveRegistry,
  resolveSlug,
  type StableSlugRegistry,
} from "./lib/stable-slugs.ts";
import type { College } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RAW_DIR = resolve(ROOT, "src/data/raw/ror");
const ZIP_CACHE_PATH = resolve(RAW_DIR, "ror-data.zip");
const JSON_CACHE_PATH = resolve(RAW_DIR, "ror-data.json");
const OUTPUT_PATH = resolve(ROOT, "src/data/generated/global-institutions.json");
const REPORT_PATH = resolve(ROOT, "src/data/generated/global-import-report.txt");
const REGISTRY_PATH = resolve(ROOT, "src/data/curated/stable-slugs.json");

const ZENODO_COMMUNITY_URL = "https://zenodo.org/api/communities/ror-data/records?sort=newest&size=1";
/**
 * Pinned fallback: the exact ROR dump this pipeline was built/verified
 * against (ROR Data 2026-08-25, schema v2.12), used if the Zenodo
 * community lookup ever fails. Override with ROR_DUMP_ZIP_URL if needed.
 */
const FALLBACK_ZIP_URL =
  "https://zenodo.org/api/records/22099990/files/v2.12-2026-08-25-ror-data.zip/content";

const forceRefresh = process.argv.includes("--refresh");
const MIN_EXPECTED_INSTITUTIONS = 1000;

type Report = {
  raw: number;
  activeEducation: number;
  validLocation: number;
  nonUS: number;
  notK12: number;
  hasWebsite: number;
  final: number;
  byContinent: Record<string, number>;
  byCountryTop: [string, number][];
  newSlugsAssigned: number;
  existingSlugsReused: number;
};

async function resolveZipUrl(): Promise<string> {
  const override = process.env.ROR_DUMP_ZIP_URL;
  if (override) {
    console.log(`[data:import:global] Using ROR_DUMP_ZIP_URL override: ${override}`);
    return override;
  }
  try {
    console.log(`[data:import:global] Looking up latest ROR data dump on Zenodo...`);
    const res = await fetch(ZENODO_COMMUNITY_URL);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const json = (await res.json()) as {
      hits: { hits: { files?: { key: string; links: { self: string } }[] }[] };
    };
    const files = json.hits.hits[0]?.files ?? [];
    const zipFile = files.find((f) => f.key.endsWith(".zip"));
    if (!zipFile) throw new Error("no .zip file in latest ror-data record");
    return zipFile.links.self;
  } catch (err) {
    console.warn(
      `[data:import:global] Zenodo lookup failed (${(err as Error).message}), using pinned fallback URL.`
    );
    return FALLBACK_ZIP_URL;
  }
}

async function ensureJson(): Promise<string> {
  mkdirSync(RAW_DIR, { recursive: true });

  if (!forceRefresh && existsSync(JSON_CACHE_PATH)) {
    console.log(`[data:import:global] Reusing cached JSON: ${JSON_CACHE_PATH} (pass --refresh to redownload)`);
    return JSON_CACHE_PATH;
  }

  if (!forceRefresh && existsSync(ZIP_CACHE_PATH)) {
    console.log(`[data:import:global] Reusing cached ZIP: ${ZIP_CACHE_PATH}`);
  } else {
    const zipUrl = await resolveZipUrl();
    console.log(`[data:import:global] Downloading ${zipUrl} ...`);
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`Failed to download ROR data dump: ${res.status} ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(ZIP_CACHE_PATH, buffer);
    console.log(`[data:import:global] Saved ${(buffer.length / 1e6).toFixed(1)} MB to ${ZIP_CACHE_PATH}`);
  }

  console.log("[data:import:global] Extracting data JSON from ZIP (this is a large file)...");
  const zip = new AdmZip(ZIP_CACHE_PATH);
  const entry = zip.getEntries().find((e) => /ror-data\.json$/i.test(e.entryName));
  if (!entry) throw new Error("Could not find a *ror-data.json entry inside the downloaded ZIP.");
  writeFileSync(JSON_CACHE_PATH, entry.getData());
  return JSON_CACHE_PATH;
}

/** Streams the (very large) JSON array so it is never fully loaded into memory at once. */
async function streamRorRecords(jsonPath: string, onRecord: (record: RorRecord) => void): Promise<void> {
  const pipeline = chain([createReadStream(jsonPath), parser(), streamArray()]);
  return new Promise((res, rej) => {
    pipeline.on("data", ({ value }: { value: RorRecord }) => onRecord(value));
    pipeline.on("end", () => res());
    pipeline.on("error", (err: Error) => rej(err));
  });
}

function formatReport(r: Report): string {
  const continentLines = Object.entries(r.byContinent)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${k}: ${v}`);
  const countryLines = r.byCountryTop.map(([k, v]) => `  ${k}: ${v}`);
  return [
    "Global (ROR) institution import complete",
    "",
    "-- Eligibility funnel --",
    `Raw organizations in dump: ${r.raw}`,
    `Active + typed "education": ${r.activeEducation}`,
    `+ valid country/coordinates: ${r.validLocation}`,
    `+ non-US: ${r.nonUS}`,
    `+ not K-12 (denylist): ${r.notK12}`,
    `+ has website (content-quality gate): ${r.hasWebsite}`,
    `Final included global institutions: ${r.final}`,
    "",
    "-- By continent --",
    ...continentLines,
    "",
    "-- Top 20 countries --",
    ...countryLines,
    "",
    "-- Stable slug registry --",
    `Existing slugs reused: ${r.existingSlugsReused}`,
    `New slugs assigned: ${r.newSlugsAssigned}`,
  ].join("\n") + "\n";
}

async function main() {
  const jsonPath = await ensureJson();
  console.log("[data:import:global] Streaming and filtering ROR records...");

  const report: Report = {
    raw: 0,
    activeEducation: 0,
    validLocation: 0,
    nonUS: 0,
    notK12: 0,
    hasWebsite: 0,
    final: 0,
    byContinent: {},
    byCountryTop: [],
    newSlugsAssigned: 0,
    existingSlugsReused: 0,
  };

  const eligible: RorRecord[] = [];

  await streamRorRecords(jsonPath, (record) => {
    report.raw += 1;
    if (!isActiveEducation(record)) return;
    report.activeEducation += 1;
    if (!hasValidLocation(record)) return;
    report.validLocation += 1;
    if (!isNonUS(record)) return;
    report.nonUS += 1;
    if (!passesK12Filter(record)) return;
    report.notK12 += 1;
    if (!hasWebsite(record)) return;
    report.hasWebsite += 1;
    if (!isEligibleGlobalInstitution(record)) return; // defensive: same conditions, belt-and-suspenders
    eligible.push(record);
  });

  console.log(`[data:import:global] ${eligible.length} institutions passed the eligibility pipeline.`);

  // --- Stable slug resolution (shared logic/registry with the US pipeline) ---
  const registryBefore = loadRegistry(REGISTRY_PATH);
  const registry: StableSlugRegistry = { ...registryBefore };
  const claimedSlugs = new Set(Object.values(registry));

  const institutions: College[] = [];
  const countryCounts = new Map<string, number>();

  for (const record of eligible) {
    const loc = record.locations![0].geonames_details!;
    const unitId = `ror:${record.id.match(/ror\.org\/([a-z0-9]+)/i)?.[1] ?? record.id}`;
    const before = registry[unitId];

    const nameForSlug = record.names?.find((n) => n.types?.includes("ror_display"))?.value ?? record.names?.[0]?.value ?? unitId;
    const { slug, isNew } = resolveSlug({
      unitId,
      name: nameForSlug,
      city: loc.name ?? "",
      stateCode: loc.country_code ?? "xx",
      registry,
      claimedSlugs,
    });

    if (before !== undefined && before !== slug) {
      throw new Error(`Stable slug changed for ${unitId} — refusing to silently move a public URL.`);
    }
    if (isNew) {
      registry[unitId] = slug;
      claimedSlugs.add(slug);
      report.newSlugsAssigned += 1;
    } else {
      report.existingSlugsReused += 1;
    }

    const institution = normalizeGlobalInstitution(record, slug);
    institutions.push(institution);

    report.byContinent[institution.continent] = (report.byContinent[institution.continent] ?? 0) + 1;
    countryCounts.set(institution.countryName, (countryCounts.get(institution.countryName) ?? 0) + 1);
  }

  report.final = institutions.length;
  report.byCountryTop = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  if (institutions.length < MIN_EXPECTED_INSTITUTIONS) {
    console.error(
      `[data:import:global] Only ${institutions.length} institutions passed (expected >= ${MIN_EXPECTED_INSTITUTIONS}). Refusing to overwrite existing output.`
    );
    writeFileSync(REPORT_PATH, formatReport(report));
    process.exitCode = 1;
    return;
  }

  institutions.sort((a, b) => a.countryCode.localeCompare(b.countryCode) || a.name.localeCompare(b.name));

  saveRegistry(REGISTRY_PATH, registry);
  mkdirSync(resolve(ROOT, "src/data/generated"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(institutions, null, 2) + "\n");

  const reportText = formatReport(report);
  writeFileSync(REPORT_PATH, reportText);
  console.log("\n" + reportText);
}

if (!process.env.VITEST) {
  main().catch((err) => {
    console.error("[data:import:global] Fatal error:", err);
    process.exitCode = 1;
  });
}
