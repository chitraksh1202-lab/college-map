const UNAVAILABLE = "Data unavailable";

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return UNAVAILABLE;
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return UNAVAILABLE;
  return `${Math.round(value * 100)}%`;
}

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return UNAVAILABLE;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatOwnership(ownership: string | undefined | null): string {
  switch (ownership) {
    case "public":
      return "Public";
    case "private-nonprofit":
      return "Private, nonprofit";
    case "private-for-profit":
      return "Private, for-profit";
    default:
      return UNAVAILABLE;
  }
}

export function formatOrFallback(value: string | undefined | null): string {
  if (!value || value.trim().length === 0) return UNAVAILABLE;
  return value;
}

export { UNAVAILABLE };
