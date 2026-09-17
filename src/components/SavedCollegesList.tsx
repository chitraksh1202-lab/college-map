import { useEffect, useMemo, useState } from "react";
import type { CollegePreview } from "@/lib/colleges";
import {
  getSavedUnitIds,
  migrateLegacySavedSlugs,
  SAVED_COLLEGES_EVENT,
  unsaveCollege,
} from "@/lib/saved-colleges";
import { getDisplayName } from "@/lib/search";
import { formatOwnership } from "@/lib/format";

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
    return <p className="text-slate-400">Loading…</p>;
  }

  const saved = colleges.filter((c) => unitIds.includes(c.unitId));

  if (saved.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-500">You haven't saved any colleges yet.</p>
        <a
          href="/"
          className="mt-4 inline-block rounded-full bg-horizon-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-horizon-700"
        >
          Explore the map
        </a>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {saved.map((college) => (
        <li
          key={college.unitId}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <a href={`/college/${college.slug}`} className="block">
            <p className="font-display font-semibold text-slate-900">{getDisplayName(college)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {college.city}, {college.stateCode} · {formatOwnership(college.ownership)}
            </p>
          </a>
          <button
            type="button"
            onClick={() => setUnitIds(unsaveCollege(college.unitId))}
            className="mt-3 text-xs font-medium text-slate-400 hover:text-sunset-600"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
