import { useEffect, useMemo, useRef, useState } from "react";
import type { CollegePreview } from "@/lib/colleges";
import { searchColleges, getDisplayName } from "@/lib/search";
import { formatOwnership } from "@/lib/format";

type Props = {
  colleges: CollegePreview[];
  size?: "default" | "large";
};

export default function SearchBox({ colleges, size = "default" }: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const results = useMemo(() => searchColleges(colleges, query, 15), [colleges, query]);
  const showDropdown = isOpen && query.trim().length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function goTo(slug: string) {
    window.location.href = `/college/${slug}`;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < results.length) {
        event.preventDefault();
        goTo(results[activeIndex].slug);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeId = activeIndex >= 0 ? `search-result-${activeIndex}` : undefined;
  const large = size === "large";

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-xl">
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-500 ${large ? "left-5 h-5 w-5" : "left-4 h-4 w-4"}`}
        >
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M18 18L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-results-list"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by college, city, or state…"
          aria-label="Search colleges"
          className={`w-full rounded-full border border-stone-200 bg-sand-50/95 text-ink-800 shadow-soft outline-none transition placeholder:text-ink-500/60 focus:border-ember-400 focus:ring-4 focus:ring-ember-50 ${
            large ? "py-4 pl-12 pr-5 text-base" : "py-3 pl-10 pr-5 text-sm"
          }`}
        />
      </div>

      {showDropdown && (
        <ul
          id="search-results-list"
          ref={listRef}
          role="listbox"
          className="animate-rise-in absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-lift"
        >
          {results.length === 0 ? (
            <li className="px-5 py-4 text-sm text-ink-500">No colleges found</li>
          ) : (
            results.map((college, index) => (
              <li key={college.slug} id={`search-result-${index}`} role="option" aria-selected={index === activeIndex}>
                <a
                  href={`/college/${college.slug}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors ${
                    index === activeIndex ? "bg-ember-50" : "hover:bg-sand-100"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-800">
                      {getDisplayName(college)}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {formatOwnership(college.ownership)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-500">
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
