import { useSavedCollege } from "@/lib/useSavedCollege";

type Props = {
  slug: string;
  className?: string;
};

export default function SaveButton({ slug, className }: Props) {
  const { saved, toggle } = useSavedCollege(slug);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className={
        className ??
        `inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition ${
          saved
            ? "bg-horizon-900 text-white hover:bg-horizon-800"
            : "bg-white text-horizon-900 ring-1 ring-inset ring-horizon-200 hover:bg-horizon-50"
        }`
      }
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
