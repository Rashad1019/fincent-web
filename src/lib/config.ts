// Shared constants. Change an assumption here and every page sees it.

// DCF assumptions, as fractions.
export const DCF = {
  growth: 0.08,
  discount: 0.1,
  terminalGrowth: 0.025,
  years: 5,
  // Second case for the personas: slower growth and a higher required return.
  slowGrowth: 0.04,
  stressDiscount: 0.12,
};

// Chart timeframes: label -> [Yahoo chart range, bar interval].
export const HISTORY_PERIODS: Record<string, [string, string]> = {
  "1 day": ["1d", "5m"],
  "1 week": ["5d", "15m"],
  "1 month": ["1mo", "1d"],
  "3 months": ["3mo", "1d"],
  "6 months": ["6mo", "1d"],
  "1 year": ["1y", "1d"],
  "5 years": ["5y", "1d"],
};
export const DEFAULT_PERIOD = "1 month";

// Daily bars used for trend, risk, and the buy answer.
export const RISK_RANGE = "1y";

// How long fetched data is reused, in seconds.
export const CACHE_SECONDS = {
  quote: 60,
  history: 15 * 60,
  profile: 24 * 60 * 60,
  dividends: 6 * 60 * 60,
  macro: 12 * 60 * 60,
  explanation: 7 * 24 * 60 * 60,
};

export const TICKER_PATTERN = /^[A-Z0-9.^=-]{1,12}$/;

export function cleanTicker(raw: string | null | undefined): string | null {
  const ticker = (raw ?? "").trim().toUpperCase();
  return TICKER_PATTERN.test(ticker) ? ticker : null;
}
