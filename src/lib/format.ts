// Display formatting shared by the pages and the persona prompts.

const twoPlaces = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export function fmtRatio(value: number | null | undefined): string {
  return value == null ? "N/A" : value.toLocaleString("en-US", twoPlaces);
}

/** Fraction to percent: 0.0325 -> "3.25%". */
export function fmtPct(value: number | null | undefined): string {
  return value == null ? "N/A" : `${(value * 100).toLocaleString("en-US", twoPlaces)}%`;
}

/** Compact money: 4.58T, 84.71B, 12.30M. */
export function fmtMoney(value: number | null | undefined): string {
  if (value == null) return "N/A";
  for (const [threshold, suffix] of [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
  ] as const) {
    if (Math.abs(value) >= threshold) return `${fmtRatio(value / threshold)}${suffix}`;
  }
  return fmtRatio(value);
}

/** A price people can read: "$759.18" for dollars, "759.18 EUR" otherwise. */
export function fmtPrice(value: number, currency?: string | null): string {
  if (!currency || currency === "USD") return `$${fmtRatio(value)}`;
  return `${fmtRatio(value)} ${currency}`;
}
