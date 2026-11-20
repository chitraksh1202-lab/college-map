import { useEffect, useMemo, useState } from "react";
import type { CollegePreview } from "@/lib/colleges";
import {
  getSavedUnitIds,
  migrateLegacySavedSlugs,
  SAVED_COLLEGES_EVENT,
  unsaveCollege,
} from "@/lib/saved-colleges";
import { getDisplayName } from "@/lib/search";
import { formatOwnership, formatNumber } from "@/lib/format";
import { loadInstitutionPreviews } from "@/lib/client-data";

/**
 * The card collection half of "My Atlas" (see also AtlasMap.tsx, its map
 * counterpart). Fetches the full worldwide preview dataset lazily
 * (public/data/institutions-preview.json) rather than receiving it as a
 * prop — with ~24k institutions worldwide, embedding that array in this
 * page's HTML would make it one of the heaviest pages on the site for
 * what is usually a handful of saves.
 */
export default function AtlasCollection() {
  const [unitIds, setUnitIds] = useState<string[] | null>(null);
  const [colleges, setColleges] = useState<CollegePreview[] | null>(null);

  useEffect(() => {
    loadInstitutionPreviews()
      .then(setColleges)
      .catch(() => setColleges([]));
  }, []);

  const slugToUnitId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of colleges ?? []) map[c.slug] = c.unitId;
    return map;
  }, [colleges]);

  useEffect(() => {
    if (!colleges) return;
    migrateLegacySavedSlugs(slugToUnitId);
    const sync = () => setUnitIds(getSavedUnitIds());
    sync();
    window.addEventListener(SAVED_COLLEGES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_COLLEGES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slugToUnitId, colleges]);

  if (unitIds === null || colleges === null) {
    return <div className="h-40" aria-hidden="true" />;
  }

  const saved = colleges.filter((c) => unitIds.includes(c.unitId));

  if (saved.length === 0) {
    return (
      <div className="rounded-[28px] bg-sand-100 px-8 py-16 text-center">
        <p className="font-display text-2xl text-ink-800">Your atlas is empty</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
          Start wandering the map and save places that make you curious. They'll show up here,
          together, as a map of everywhere you're considering.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-ink-800 active:scale-95"
        >
          Explore the map
        </a>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-ink-500">
        {saved.length} place{saved.length === 1 ? "" : "s"} you've discovered.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {saved.map((college) => {
          const displayName = getDisplayName(college);
          return (
            <li
              key={college.unitId}
              className="group rounded-2xl bg-sand-100 p-4 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-sand-200 hover:shadow-soft"
            >
              <a href={`/college/${college.slug}`} className="block" data-track="college_opened" data-track-slug={college.slug}>
                <p className="truncate font-display font-semibold text-ink-900">{displayName}</p>
                <p className="mt-1 truncate text-sm text-ink-500">
                  {college.city}, {college.stateCode ?? college.countryName}
                  {college.ownership ? ` · ${formatOwnership(college.ownership)}` : ""}
                </p>
                {college.undergraduateEnrollment !== undefined && (
                  <p className="mt-1 text-xs text-ink-500/80">
                    {formatNumber(college.undergraduateEnrollment)} undergrads
                  </p>
                )}
              </a>
              <button
                type="button"
                onClick={() => setUnitIds(unsaveCollege(college.unitId))}
                aria-label={`Remove ${displayName} from your atlas`}
                className="mt-3 text-xs font-medium text-ink-500/70 transition hover:text-ember-600"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
