// The number block the personas see. Keys match METRIC_LABELS in prompt.ts.

import { DCF } from "../config";
import { dividendYieldRange, trailingYield } from "../analytics/dividends";
import { annualizedVolatility, historicalVar, sharpeRatio } from "../analytics/risk";
import { buildSummary, priceLevels, sentiment } from "../analytics/technicals";
import { computeRatios, dcfValue, pegRatio } from "../analytics/valuation";
import type { Macro } from "../data/macro";
import type { Bar, Dividend, Fundamentals } from "../data/types";
import type { Metrics } from "./prompt";

// How far a stock's reported yield can sit from its payouts before it is
// treated as bad. Wide enough that a special dividend doesn't trip it.
const YIELD_MISMATCH = 5;

/**
 * Funds always use payouts, since reported fund yields are unreliable.
 * Stocks keep the reported yield unless it is missing or far from what was paid.
 */
export function bestYield(reported: number | null, paid: number | null, isFund: boolean): number | null {
  if (paid == null) return reported;
  if (isFund || !reported) return paid;
  return Math.max(reported, paid) / Math.min(reported, paid) > YIELD_MISMATCH ? paid : reported;
}

function perShareDcf(fcf: number | null, shares: number | null, growth: number, discount: number) {
  if (!fcf || !shares) return null;
  return dcfValue(fcf, growth, discount, DCF.terminalGrowth, DCF.years) / shares;
}

function safe<T>(compute: () => T): T | null {
  try {
    return compute();
  } catch {
    return null;
  }
}

export function assembleMetrics(
  f: Fundamentals,
  closes: number[],
  dividends: Dividend[],
  macro: Macro,
  longBars: Bar[],
): Metrics {
  const ratios = computeRatios(f);
  const summary = buildSummary(closes);
  const mood = sentiment(summary);
  const levels = priceLevels(closes, summary);
  const range = dividendYieldRange(longBars, dividends);
  const paid = trailingYield(f.price, dividends);

  return {
    price: f.price,
    market_cap: f.marketCap,
    eps: f.eps,
    dividend_yield: bestYield(f.dividendYield, paid, f.isFund),
    payout_ratio: f.payoutRatio,
    revenue: f.revenue,
    net_income: f.netIncome,
    free_cash_flow: f.freeCashFlow,
    earnings_growth: f.earningsGrowth,
    pe_ratio: ratios.peRatio,
    pb_ratio: ratios.pbRatio,
    roe: ratios.roe,
    debt_to_equity: ratios.debtToEquity,
    profit_margin: ratios.profitMargin,
    peg_ratio: pegRatio(ratios.peRatio, f.earningsGrowth),
    dcf_value_per_share: perShareDcf(f.freeCashFlow, f.sharesOutstanding, DCF.growth, DCF.discount),
    dcf_conservative_per_share: perShareDcf(f.freeCashFlow, f.sharesOutstanding, DCF.slowGrowth, DCF.stressDiscount),
    annualized_volatility: safe(() => annualizedVolatility(closes)),
    sharpe_ratio: safe(() => sharpeRatio(closes)),
    historical_var_95: safe(() => historicalVar(closes)),
    rsi_14: summary.rsi14,
    return_1mo: summary.return1mo,
    technical_sentiment: `${mood.label} (score ${mood.score >= 0 ? "+" : ""}${mood.score})`,
    better_price: levels.betterPrice,
    trend_line: levels.trendLine,
    dividend_yield_low: range?.low ?? null,
    dividend_yield_high: range?.high ?? null,
    dividend_yield_paid: paid,
    ten_year_yield: macro.tenYearYield,
    inflation_yoy: macro.inflationYoy,
  };
}
