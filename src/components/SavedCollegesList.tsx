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

type Props = {
  /** Passed from the server — never imports lib/colleges.ts client-side (keeps this island's bundle tiny). */
  colleges: CollegePreview[];
};

export default function SavedCollegesList({ colleges }: Props) {
  const [unitIds, setUnitIds] = useState<string[] | null>(null);

  const slugToUnitId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of colleges) map[c.slug] = c.unitId;
    return map;
  }, [colleges]);

  useEffect(() => {
    migrateLegacySavedSlugs(slugToUnitId);
    const sync = () => setUnitIds(getSavedUnitIds());
    sync();
    window.addEventListener(SAVED_COLLEGES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_COLLEGES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slugToUnitId]);

  if (unitIds === null) {
    return <div className="h-40" aria-hidden="true" />;
  }

  const saved = colleges.filter((c) => unitIds.includes(c.unitId));

  if (saved.length === 0) {
    return (
      <div className="rounded-3xl bg-sand-100 px-8 py-16 text-center">
        <p className="font-display text-xl text-ink-800">Nothing saved yet</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-500">
          Find a college on the map and save it to come back to later.
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
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {saved.map((college) => (
        <li
          key={college.unitId}
          className="group rounded-2xl bg-sand-100 p-4 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-sand-200 hover:shadow-soft"
        >
          <a href={`/college/${college.slug}`} className="block">
            <p className="truncate font-display font-semibold text-ink-900">{getDisplayName(college)}</p>
            <p className="mt-1 truncate text-sm text-ink-500">
              {college.city}, {college.stateCode} · {formatOwnership(college.ownership)}
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
            className="mt-3 text-xs font-medium text-ink-500/70 transition hover:text-ember-600"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
