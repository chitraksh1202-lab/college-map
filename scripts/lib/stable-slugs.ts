/**
 * Stable UNITID -> slug registry.
 *
 * The permanent identity of a college is its Scorecard/IPEDS UNITID, not
 * its current display name. This module is the single place that decides
 * what URL slug a UNITID gets, and guarantees that decision is made once
 * and never silently changed by a later import (see resolveSlug below).
 *
 * File I/O lives in loadRegistry/saveRegistry/loadRedirects so the
 * resolution logic itself (resolveSlug, validateRedirects) stays pure and
 * directly unit-testable without touching disk.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** UNITID -> permanently assigned slug. Append-only: entries are never removed or overwritten. */
export type StableSlugRegistry = Record<string, string>;

/** old slug -> current canonical slug. */
export type SlugRedirects = Record<string, string>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function loadRegistry(path: string): StableSlugRegistry {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as StableSlugRegistry;
}

export function saveRegistry(path: string, registry: StableSlugRegistry): void {
  const sorted: StableSlugRegistry = {};
  for (const unitId of Object.keys(registry).sort()) sorted[unitId] = registry[unitId];
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
}

export function loadRedirects(path: string): SlugRedirects {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as SlugRedirects;
}

export type ResolveResult = { slug: string; isNew: boolean };

/**
 * Resolves the slug for one UNITID. Pure function — takes the registry
 * and the set of slugs already claimed (by the registry plus anything
 * assigned earlier in the same run) and returns a decision without
 * mutating anything.
 *
 * - If the UNITID already has a registry entry, that slug is returned
 *   unconditionally — this is the whole point: an official name change
 *   must never change the URL.
 * - Otherwise a fresh slug is generated from the current name and
 *   deconflicted deterministically: name -> name-state -> name-city-state
 *   -> name-unitid.
 */
export function resolveSlug(params: {
  unitId: string;
  name: string;
  city: string;
  stateCode: string;
  registry: StableSlugRegistry;
  claimedSlugs: ReadonlySet<string>;
}): ResolveResult {
  const { unitId, name, city, stateCode, registry, claimedSlugs } = params;

  const existing = registry[unitId];
  if (existing !== undefined) {
    return { slug: existing, isNew: false };
  }

  const base = slugify(name);
  const candidates = [
    base,
    `${base}-${slugify(stateCode)}`,
    `${base}-${slugify(city)}-${slugify(stateCode)}`,
    `${base}-${unitId}`,
  ];

  for (const candidate of candidates) {
    if (!claimedSlugs.has(candidate)) {
      return { slug: candidate, isNew: true };
    }
  }

  // Exhausted the deterministic sequence (should be astronomically rare —
  // would require the same name+city+state+unitid combination already
  // claimed, i.e. a genuine duplicate UNITID upstream).
  throw new Error(
    `Could not assign a unique slug for UNITID ${unitId} ("${name}") — all deterministic candidates are already claimed.`
  );
}

/**
 * Validates a redirect map on its own terms: no self-redirects, no
 * chains/loops, no source that is also someone's current canonical slug,
 * and every target must actually exist in the current registry.
 */
export function validateRedirects(
  redirects: SlugRedirects,
  registry: StableSlugRegistry
): string[] {
  const errors: string[] = [];
  const canonicalSlugs = new Set(Object.values(registry));
  const sources = Object.keys(redirects);

  for (const source of sources) {
    const target = redirects[source];

    if (source === target) {
      errors.push(`redirect "${source}" points to itself`);
      continue;
    }
    if (redirects[target] !== undefined) {
      errors.push(`redirect chain detected: "${source}" -> "${target}" -> "${redirects[target]}" (redirects must point directly to a canonical slug, not to another redirect)`);
      continue;
    }
    if (!canonicalSlugs.has(target)) {
      errors.push(`redirect "${source}" -> "${target}" targets a slug that isn't any UNITID's current canonical slug`);
    }
    if (canonicalSlugs.has(source)) {
      errors.push(`redirect source "${source}" is also currently a canonical slug for another institution — refusing to shadow a live route`);
    }
  }

  return errors;
}
