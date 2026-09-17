import { useState } from "react";
import { getTeleportHistory, recordTeleport } from "@/lib/teleport-history";

type Props = {
  /** All college slugs to pick from — pass slugs only, never full records, to keep this island's bundle tiny. */
  allSlugs: string[];
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

export default function TeleportButton({ allSlugs, currentSlug, className, label = "Surprise me" }: Props) {
  const [isNavigating, setIsNavigating] = useState(false);

  function teleport() {
    setIsNavigating(true);
    const recent = getTeleportHistory();
    const exclude = currentSlug ? [...recent, currentSlug] : recent;
    const destinationSlug = pickRandom(allSlugs, exclude);
    recordTeleport(destinationSlug);
    window.location.href = `/college/${destinationSlug}`;
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
