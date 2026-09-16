import { useEffect, useState } from "react";
import { getAllColleges } from "@/lib/colleges";
import { getSavedSlugs, SAVED_COLLEGES_EVENT, unsaveCollege } from "@/lib/saved-colleges";
import { formatOwnership } from "@/lib/format";

export default function SavedCollegesList() {
  const [slugs, setSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    const sync = () => setSlugs(getSavedSlugs());
    sync();
    window.addEventListener(SAVED_COLLEGES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_COLLEGES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (slugs === null) {
    return <p className="text-slate-400">Loading…</p>;
  }

  const colleges = getAllColleges().filter((c) => slugs.includes(c.slug));

  if (colleges.length === 0) {
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
      {colleges.map((college) => (
        <li
          key={college.slug}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <a href={`/college/${college.slug}`} className="block">
            <p className="font-display font-semibold text-slate-900">{college.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {college.city}, {college.stateCode} · {formatOwnership(college.ownership)}
            </p>
          </a>
          <button
            type="button"
            onClick={() => setSlugs(unsaveCollege(college.slug))}
            className="mt-3 text-xs font-medium text-slate-400 hover:text-sunset-600"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
