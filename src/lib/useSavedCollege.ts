import { useCallback, useEffect, useState } from "react";
import { isCollegeSaved, toggleSavedCollege, SAVED_COLLEGES_EVENT } from "@/lib/saved-colleges";

/** Tracks saved state for a single college (by UNITID) and stays in sync across components/tabs. */
export function useSavedCollege(unitId: string) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isCollegeSaved(unitId));
    const sync = () => setSaved(isCollegeSaved(unitId));
    window.addEventListener(SAVED_COLLEGES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_COLLEGES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [unitId]);

  const toggle = useCallback(() => {
    const result = toggleSavedCollege(unitId);
    setSaved(result.saved);
  }, [unitId]);

  return { saved, toggle };
}
