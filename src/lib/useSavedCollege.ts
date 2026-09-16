import { useCallback, useEffect, useState } from "react";
import { isCollegeSaved, toggleSavedCollege, SAVED_COLLEGES_EVENT } from "@/lib/saved-colleges";

/** Tracks saved state for a single college slug and stays in sync across components/tabs. */
export function useSavedCollege(slug: string) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isCollegeSaved(slug));
    const sync = () => setSaved(isCollegeSaved(slug));
    window.addEventListener(SAVED_COLLEGES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_COLLEGES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  const toggle = useCallback(() => {
    const result = toggleSavedCollege(slug);
    setSaved(result.saved);
  }, [slug]);

  return { saved, toggle };
}
