import { useState } from "react";
import { getRandomCollege } from "@/lib/colleges";

type Props = {
  currentSlug?: string;
  className?: string;
};

export default function TeleportButton({ currentSlug, className }: Props) {
  const [isNavigating, setIsNavigating] = useState(false);

  function teleport() {
    setIsNavigating(true);
    const destination = getRandomCollege(currentSlug);
    window.location.href = `/college/${destination.slug}`;
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
      {isNavigating ? "Teleporting…" : "Teleport Me"}
    </button>
  );
}
