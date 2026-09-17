import { useSavedCollege } from "@/lib/useSavedCollege";

type Props = {
  /** UNITID — the stable identity saves persist against, not the (mutable) slug. */
  unitId: string;
  className?: string;
};

export default function SaveButton({ unitId, className }: Props) {
  const { saved, toggle } = useSavedCollege(unitId);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className={
        className ??
        `inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-soft transition active:scale-95 ${
          saved
            ? "bg-ink-900 text-sand-50 hover:bg-ink-800"
            : "bg-white text-ink-900 ring-1 ring-inset ring-stone-200 hover:bg-sand-100"
        }`
      }
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
