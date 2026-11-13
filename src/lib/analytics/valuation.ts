// Ratios and the DCF. Every ratio is null when undefined (zero or negative
// denominator, missing input) so the page shows N/A instead of nonsense.

import type { Fundamentals } from "../data/types";

type N = number | null | undefined;

const positive = (value: N): value is number => value != null && value > 0;

export const peRatio = (price: N, eps: N) => (price != null && positive(eps) ? price / eps : null);
export const pbRatio = (price: N, book: N) => (price != null && positive(book) ? price / book : null);
export const roe = (netIncome: N, equity: N) => (netIncome != null && positive(equity) ? netIncome / equity : null);
export const debtToEquity = (debt: N, equity: N) => (debt != null && positive(equity) ? debt / equity : null);
export const profitMargin = (netIncome: N, revenue: N) =>
  netIncome != null && positive(revenue) ? netIncome / revenue : null;

/** P/E divided by growth in percentage points. growth is a fraction. */
export const pegRatio = (pe: N, growth: N) => (pe != null && positive(growth) ? pe / (growth * 100) : null);

export function computeRatios(f: Partial<Fundamentals>) {
  return {
    peRatio: peRatio(f.price, f.eps),
    pbRatio: pbRatio(f.price, f.bookValuePerShare),
    roe: roe(f.netIncome, f.shareholderEquity),
    debtToEquity: debtToEquity(f.totalDebt, f.shareholderEquity),
    profitMargin: profitMargin(f.netIncome, f.revenue),
  };
}

/** Present value of projected free cash flows plus a terminal value. */
export function dcfValue(
  fcf: number,
  growthRate: number,
  discountRate: number,
  terminalGrowth: number,
  years = 5,
): number {
  if (years < 1) throw new Error("Years must be at least 1.");
  if (discountRate <= terminalGrowth) throw new Error("The discount rate must be higher than terminal growth.");
  let presentValue = 0;
  let projected = fcf;
  for (let year = 1; year <= years; year++) {
    projected *= 1 + growthRate;
    presentValue += projected / (1 + discountRate) ** year;
  }
  const terminal = (projected * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  return presentValue + terminal / (1 + discountRate) ** years;
}
