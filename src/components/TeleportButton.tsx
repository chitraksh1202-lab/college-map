import { useState } from "react";
import { getTeleportHistory, recordTeleport } from "@/lib/teleport-history";

type Props = {
  /** All college slugs to pick from — pass slugs only, never full records, to keep this island's bundle tiny. */
  allSlugs: string[];
  currentSlug?: string;
  className?: string;
};

function pickRandom(allSlugs: string[], exclude: string[]): string {
  const excluded = new Set(exclude);
  const pool = allSlugs.filter((slug) => !excluded.has(slug));
  const candidates = pool.length > 0 ? pool : allSlugs;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function TeleportButton({ allSlugs, currentSlug, className }: Props) {
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
        "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sunset-500 to-sunset-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-70"
      }
    >
      <span aria-hidden="true">🎲</span>
      {isNavigating ? "Teleporting…" : "Teleport me somewhere new"}
    </button>
  );
}
