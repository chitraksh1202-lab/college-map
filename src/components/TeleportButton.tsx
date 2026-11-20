import { useState } from "react";
import { getTeleportHistory, recordTeleport } from "@/lib/teleport-history";
import { loadAllSlugs } from "@/lib/client-data";
import { track } from "@/lib/analytics";

type Props = {
  currentSlug?: string;
  className?: string;
  label?: string;
};

function pickRandom(allSlugs: string[], exclude: string[]): string {
  const excluded = new Set(exclude);
  const pool = allSlugs.filter((slug) => !excluded.has(slug));
  const candidates = pool.length > 0 ? pool : allSlugs;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Picks a random institution from the FULL worldwide dataset (not just
 * whatever page it's rendered on) — fetched lazily on click from
 * public/data/slugs.json rather than passed in as a prop, since that list
 * is now ~24k entries (US + global) and would otherwise be embedded in
 * every single page's HTML.
 */
export default function TeleportButton({ currentSlug, className, label = "Surprise me" }: Props) {
  const [isNavigating, setIsNavigating] = useState(false);

  async function teleport() {
    setIsNavigating(true);
    try {
      const allSlugs = await loadAllSlugs();
      const recent = getTeleportHistory();
      const exclude = currentSlug ? [...recent, currentSlug] : recent;
      const destinationSlug = pickRandom(allSlugs, exclude);
      recordTeleport(destinationSlug);
      track("surprise_me_used", { from: currentSlug ?? "home", to: destinationSlug });
      window.location.href = `/college/${destinationSlug}`;
    } catch {
      setIsNavigating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={teleport}
      disabled={isNavigating}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full bg-ember-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-ember-600 active:scale-95 disabled:opacity-70"
      }
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M10 2.5l1.4 3.9 3.9 1.4-3.9 1.4L10 13.1l-1.4-3.9-3.9-1.4 3.9-1.4L10 2.5z"
          fill="currentColor"
        />
        <path d="M15.8 12l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" fill="currentColor" />
      </svg>
      {isNavigating ? "Teleporting…" : label}
    </button>
  );
}
