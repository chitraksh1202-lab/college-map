import { useMemo, useState } from "react";
import type { College } from "@/lib/types";

type Props = {
  colleges: College[];
};

function matches(college: College, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return false;
  return (
    college.name.toLowerCase().includes(q) ||
    (college.shortName?.toLowerCase().includes(q) ?? false) ||
    college.city.toLowerCase().includes(q) ||
    college.state.toLowerCase().includes(q) ||
    college.stateCode.toLowerCase() === q
  );
}

export default function SearchBox({ colleges }: Props) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => {
    if (query.trim().length === 0) return [];
    return colleges.filter((college) => matches(college, query)).slice(0, 20);
  }, [colleges, query]);

  const showDropdown = isFocused && query.trim().length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        placeholder="Search by college, city, or state…"
        aria-label="Search colleges"
        className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-horizon-400 focus:ring-2 focus:ring-horizon-100"
      />

      {showDropdown && (
        <ul className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-xl">
          {results.length === 0 ? (
            <li className="px-5 py-3 text-sm text-slate-400">No colleges found</li>
          ) : (
            results.map((college) => (
              <li key={college.slug}>
                <a
                  href={`/college/${college.slug}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-horizon-50"
                >
                  <span className="font-medium text-slate-800">{college.name}</span>
                  <span className="text-slate-400">
                    {college.city}, {college.stateCode}
                  </span>
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
