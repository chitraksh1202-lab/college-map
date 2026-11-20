import { useEffect, useRef, useState } from "react";
import type { CollegePreview } from "@/lib/colleges";
import { getSavedUnitIds, SAVED_COLLEGES_EVENT } from "@/lib/saved-colleges";
import { loadInstitutionPreviews } from "@/lib/client-data";
import MapExplorer from "@/components/MapExplorer";

/**
 * The map half of "My Atlas" — every saved college shown together so a
 * student can see the geography of their own list at a glance. Reuses
 * MapExplorer exactly as state/country pages do (a small, page-scoped
 * `colleges` array), just computed client-side from localStorage instead
 * of passed down from an Astro frontmatter. MapExplorer already handles
 * the "data arrives after mount" case (see its `pool` effect), so no
 * changes were needed there for this to work.
 */
export default function AtlasMap() {
  const [saved, setSaved] = useState<CollegePreview[] | null>(null);
  const allRef = useRef<CollegePreview[]>([]);

  useEffect(() => {
    function recompute() {
      const unitIds = new Set(getSavedUnitIds());
      setSaved(allRef.current.filter((c) => unitIds.has(c.unitId)));
    }

    loadInstitutionPreviews()
      .then((data) => {
        allRef.current = data;
        recompute();
      })
      .catch(() => setSaved([]));

    window.addEventListener(SAVED_COLLEGES_EVENT, recompute);
    window.addEventListener("storage", recompute);
    return () => {
      window.removeEventListener(SAVED_COLLEGES_EVENT, recompute);
      window.removeEventListener("storage", recompute);
    };
  }, []);

  if (saved === null) {
    return <div className="h-[50vh] min-h-[320px] animate-pulse rounded-[28px] bg-sand-100" aria-hidden="true" />;
  }

  // Nothing to show yet — the page's own empty state (below the map,
  // rendered by SavedCollegesList) carries the "go explore" message, so
  // the map itself just steps aside rather than showing an empty canvas.
  if (saved.length === 0) return null;

  return <MapExplorer colleges={saved} />;
}
