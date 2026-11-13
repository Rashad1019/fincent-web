// Risk numbers from daily closes.

export const TRADING_DAYS_PER_YEAR = 252;

function dailyReturns(prices: number[]): number[] {
  const clean = prices.filter((p) => Number.isFinite(p));
  if (clean.length < 2) throw new Error("need at least 2 prices to compute returns");
  const returns: number[] = [];
  for (let i = 1; i < clean.length; i++) returns.push(clean[i] / clean[i - 1] - 1);
  return returns;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

/** Sample standard deviation of daily returns, annualized. */
export function annualizedVolatility(prices: number[]): number {
  return sampleStd(dailyReturns(prices)) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/** Annualized Sharpe ratio, or null when volatility is zero. */
export function sharpeRatio(prices: number[], riskFreeRate = 0): number | null {
  const returns = dailyReturns(prices);
  const volatility = sampleStd(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  if (volatility === 0) return null;
  return (mean(returns) * TRADING_DAYS_PER_YEAR - riskFreeRate) / volatility;
}

/** numpy.percentile with linear interpolation. */
function percentile(values: number[], pct: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (pct / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/** The one-day loss, as a positive fraction, not exceeded at this confidence. */
export function historicalVar(prices: number[], confidence = 0.95): number {
  if (!(confidence > 0 && confidence < 1)) throw new Error("confidence must be between 0 and 1");
  return -percentile(dailyReturns(prices), (1 - confidence) * 100);
}
