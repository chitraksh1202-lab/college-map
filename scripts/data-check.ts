/**
 * npm run data:check
 *
 * Validates the generated dataset and the stable-slug/redirect
 * architecture WITHOUT touching the network or re-downloading anything.
 * Run after `npm run data:import`, and in CI before a build, to catch a
 * corrupted registry or a bad hand-edit to slug-redirects.json before it
 * ships. Fails loudly (non-zero exit) on any violation — never silently
 * passes over a problem.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadRegistry, loadRedirects, validateRedirects } from "./lib/stable-slugs.ts";
import type { College } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const COLLEGES_PATH = resolve(ROOT, "src/data/generated/institutions.json");
const REGISTRY_PATH = resolve(ROOT, "src/data/curated/stable-slugs.json");
const REDIRECTS_PATH = resolve(ROOT, "src/data/curated/slug-redirects.json");

const errors: string[] = [];
const info: string[] = [];

function fail(message: string) {
  errors.push(message);
}

function main() {
  const colleges = JSON.parse(readFileSync(COLLEGES_PATH, "utf8")) as College[];
  const registry = loadRegistry(REGISTRY_PATH);
  const redirects = loadRedirects(REDIRECTS_PATH);

  const usCount = colleges.filter((c) => c.source === "scorecard").length;
  const globalCount = colleges.filter((c) => c.source === "ror").length;
  info.push(`Generated dataset: ${colleges.length} institutions (${usCount} US / ${globalCount} global)`);
  info.push(`Stable slug registry: ${Object.keys(registry).length} entries`);
  info.push(`Redirects: ${Object.keys(redirects).length} entries`);

  // --- Every institution has the required global identity fields. ---
  for (const college of colleges) {
    if (!college.source) fail(`UNITID ${college.unitId} (${college.name}) is missing "source"`);
    if (!college.countryCode) fail(`UNITID ${college.unitId} (${college.name}) is missing "countryCode"`);
    if (!college.countryName) fail(`UNITID ${college.unitId} (${college.name}) is missing "countryName"`);
    if (!college.continent) fail(`UNITID ${college.unitId} (${college.name}) is missing "continent"`);
    if (college.source === "scorecard" && !college.unitId.match(/^\d+$/)) {
      fail(`Scorecard institution ${college.unitId} does not look like a raw UNITID`);
    }
    if (college.source === "ror" && !college.unitId.startsWith("ror:")) {
      fail(`ROR institution ${college.unitId} does not have the expected "ror:" prefix`);
    }
    const lat = college.latitude;
    const lon = college.longitude;
    if (typeof lat !== "number" || lat < -90 || lat > 90 || Number.isNaN(lat)) {
      fail(`UNITID ${college.unitId} (${college.name}) has an invalid latitude ${lat}`);
    }
    if (typeof lon !== "number" || lon < -180 || lon > 180 || Number.isNaN(lon)) {
      fail(`UNITID ${college.unitId} (${college.name}) has an invalid longitude ${lon}`);
    }
  }

  // --- Every current college has exactly one stable slug, and it matches the registry. ---
  for (const college of colleges) {
    const registered = registry[college.unitId];
    if (registered === undefined) {
      fail(`UNITID ${college.unitId} (${college.name}) is in colleges.json but has no stable-slug registry entry`);
    } else if (registered !== college.slug) {
      fail(
        `UNITID ${college.unitId} (${college.name}): colleges.json slug "${college.slug}" does not match registry slug "${registered}"`
      );
    }
  }

  // --- No duplicate assigned slugs; no slug assigned to multiple UNITIDs. ---
  const slugToUnitIds = new Map<string, string[]>();
  for (const [unitId, slug] of Object.entries(registry)) {
    const list = slugToUnitIds.get(slug) ?? [];
    list.push(unitId);
    slugToUnitIds.set(slug, list);
  }
  for (const [slug, unitIds] of slugToUnitIds) {
    if (unitIds.length > 1) {
      fail(`Slug "${slug}" is assigned to multiple UNITIDs in the registry: ${unitIds.join(", ")}`);
    }
  }

  // --- colleges.json itself has no duplicate slugs/UNITIDs. ---
  const seenSlugs = new Set<string>();
  const seenUnitIds = new Set<string>();
  for (const college of colleges) {
    if (seenSlugs.has(college.slug)) fail(`Duplicate slug in colleges.json: ${college.slug}`);
    seenSlugs.add(college.slug);
    if (seenUnitIds.has(college.unitId)) fail(`Duplicate UNITID in colleges.json: ${college.unitId}`);
    seenUnitIds.add(college.unitId);
  }

  // --- Redirects: no loops, sources unique (guaranteed by JSON object
  // keys), targets exist, no canonical slug also redirected elsewhere. ---
  const redirectErrors = validateRedirects(redirects, registry);
  for (const e of redirectErrors) fail(e);

  // --- All generated college routes resolve (slug is non-empty, unique — already checked above). ---
  for (const college of colleges) {
    if (!college.slug || college.slug.trim().length === 0) {
      fail(`UNITID ${college.unitId} has an empty slug`);
    }
  }

  const historicalOnly = Object.keys(registry).filter((id) => !seenUnitIds.has(id));
  info.push(`Historical registry entries not in current dataset: ${historicalOnly.length}`);

  console.log(info.join("\n"));

  if (errors.length > 0) {
    console.error(`\ndata:check FAILED with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log("\ndata:check passed — no violations found.");
  }
}

main();
