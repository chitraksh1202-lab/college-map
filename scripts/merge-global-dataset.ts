/**
 * Combines the US (College Scorecard) and global (ROR) datasets into the
 * single file the app actually reads (src/lib/colleges.ts), plus the
 * lightweight public/data/*.json assets the client-side map/search/
 * teleport islands fetch instead of embedding the full dataset in every
 * page's HTML (see Phase 9/24 in the global-expansion brief: never ship
 * the whole world to every page).
 *
 * Run with: npm run data:merge (also run automatically by `npm run data:import`)
 *
 * US/global dedupe policy (Phase 3/8): College Scorecard is the sole
 * authority for US institutions. The global importer already excludes
 * every US record from ROR (see scripts/lib/global-institutions.ts
 * isNonUS), so this merge is a straight concatenation — there is nothing
 * to fuzzy-match, and therefore nothing ambiguous to get wrong.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { College } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const US_PATH = resolve(ROOT, "src/data/generated/colleges.json");
const GLOBAL_PATH = resolve(ROOT, "src/data/generated/global-institutions.json");
const OUTPUT_PATH = resolve(ROOT, "src/data/generated/institutions.json");
const REPORT_PATH = resolve(ROOT, "src/data/generated/merge-report.txt");

const PUBLIC_DATA_DIR = resolve(ROOT, "public/data");
const PREVIEW_OUTPUT_PATH = resolve(PUBLIC_DATA_DIR, "institutions-preview.json");
const SLUGS_OUTPUT_PATH = resolve(PUBLIC_DATA_DIR, "slugs.json");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function main() {
  if (!existsSync(US_PATH)) {
    throw new Error(`${US_PATH} not found — run "npm run data:import" first.`);
  }
  if (!existsSync(GLOBAL_PATH)) {
    throw new Error(`${GLOBAL_PATH} not found — run "npm run data:import:global" first.`);
  }

  const us = readJson<College[]>(US_PATH);
  const allGlobal = readJson<College[]>(GLOBAL_PATH);

  // Cloudflare's free plan caps a deployment at 20,000 static files and every
  // institution is one prerendered page. Keep a deterministic per-country
  // sample (first N by unitId) so worldwide coverage survives. The full
  // source remains in global-institutions.json; raise the cap on a paid plan.
  const MAX_GLOBAL_PER_COUNTRY = 600;
  const perCountry = new Map<string, number>();
  const global = [...allGlobal]
    .sort((a, b) => a.unitId.localeCompare(b.unitId))
    .filter((c) => {
      const n = (perCountry.get(c.countryCode ?? "") ?? 0) + 1;
      perCountry.set(c.countryCode ?? "", n);
      return n <= MAX_GLOBAL_PER_COUNTRY;
    });
  const merged = [...us, ...global];

  // Defensive: the two sources use disjoint unitId formats by construction
  // (raw UNITID vs "ror:..."), and slugs come from one shared registry —
  // but verify rather than assume before shipping anything.
  const unitIds = new Set<string>();
  const slugs = new Set<string>();
  for (const c of merged) {
    if (unitIds.has(c.unitId)) throw new Error(`Duplicate unitId across merged dataset: ${c.unitId}`);
    unitIds.add(c.unitId);
    if (slugs.has(c.slug)) throw new Error(`Duplicate slug across merged dataset: ${c.slug}`);
    slugs.add(c.slug);
  }

  merged.sort((a, b) => a.unitId.localeCompare(b.unitId));

  mkdirSync(resolve(ROOT, "src/data/generated"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2) + "\n");

  // --- Public, client-fetched map/search payload -------------------------
  // Only the fields the map/search islands need — no US-only statistics
  // shipped to every visitor worldwide (Phase 9). ~29k records at these
  // few short fields keeps this a one-time few-MB fetch, not a per-page
  // embed (the previous US-only homepage embedded ~1800 records inline;
  // doing that for ~24k would bloat every page's HTML).
  const preview = merged.map((c) => ({
    unitId: c.unitId,
    slug: c.slug,
    name: c.name,
    city: c.city,
    state: c.state,
    stateCode: c.stateCode,
    countryCode: c.countryCode,
    countryName: c.countryName,
    latitude: c.latitude,
    longitude: c.longitude,
    ownership: c.ownership,
    undergraduateEnrollment: c.undergraduateEnrollment,
    campusSetting: c.campusSetting,
  }));
  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  writeFileSync(PREVIEW_OUTPUT_PATH, JSON.stringify(preview));
  writeFileSync(SLUGS_OUTPUT_PATH, JSON.stringify(merged.map((c) => c.slug)));

  const previewBytes = Buffer.byteLength(JSON.stringify(preview));
  const slugsBytes = Buffer.byteLength(JSON.stringify(merged.map((c) => c.slug)));

  const report = [
    "Global merge complete",
    "",
    `US (Scorecard) institutions: ${us.length}`,
    `Global (ROR) institutions: ${global.length}`,
    `Total merged: ${merged.length}`,
    "",
    `public/data/institutions-preview.json: ${(previewBytes / 1e6).toFixed(2)} MB`,
    `public/data/slugs.json: ${(slugsBytes / 1e6).toFixed(2)} MB`,
  ].join("\n") + "\n";
  writeFileSync(REPORT_PATH, report);
  console.log(report);
}

main();
