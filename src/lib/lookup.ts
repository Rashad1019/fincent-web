import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_SECONDS, RISK_RANGE } from "./config";
import { assembleMetrics } from "./agents/metrics";
import type { Metrics } from "./agents/prompt";
import { annualizedVolatility, historicalVar, sharpeRatio } from "./analytics/risk";
import {
  buildSummary,
  buyAnswer,
  entryRead,
  priceLevels,
  sentiment,
  type BuyAnswer,
  type Entry,
  type Levels,
  type Mood,
} from "./analytics/technicals";
import { getMacro } from "./data/macro";
import * as sec from "./data/sec";
import type { Bar, Fundamentals, History, Profile } from "./data/types";
import { FUND_TYPES, getDividends, getHistory, KINDS } from "./data/yahoo";

/** Everything the dashboard, Analytics, and the personas need for one ticker. */
export type Lookup = {
  ticker: string;
  name: string;
  price: number;
  currency: string | null;
  isFund: boolean;
  profile: Profile;
  mood: Mood;
  entry: Entry;
  levels: Levels;
  buy: BuyAnswer;
  metrics: Metrics;
  hasFundamentals: boolean;
  analytics: {
    freeCashFlow: number | null;
    sharesOutstanding: number | null;
    volatility: number | null;
    sharpe: number | null;
    var95: number | null;
  };
};

const optional = <T>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

/** Daily bars from Yahoo. */
export function dailyHistory(ticker: string, range: string): Promise<History> {
  return getHistory(ticker, range, "1d", CACHE_SECONDS.history);
}

function priceOnly(price: number, isFund: boolean): Fundamentals {
  return {
    price,
    isFund,
    marketCap: null,
    eps: null,
    dividendYield: null,
    payoutRatio: null,
    bookValuePerShare: null,
    netIncome: null,
    shareholderEquity: null,
    totalDebt: null,
    revenue: null,
    freeCashFlow: null,
    sharesOutstanding: null,
    earningsGrowth: null,
  };
}

function safe<T>(compute: () => T): T | null {
  try {
    return compute();
  } catch {
    return null;
  }
}

async function buildLookup(ticker: string): Promise<Lookup> {
  const year = await dailyHistory(ticker, RISK_RANGE);
  const { meta } = year;
  const closes = year.bars.map((bar) => bar.close);
  const price = meta.price ?? closes[closes.length - 1];
  const currency = meta.currency;
  const isFund = FUND_TYPES.has(meta.instrumentType ?? "");

  const [dividends, macro, fiveYears, companyFigures] = await Promise.all([
    getDividends(ticker).catch(() => []),
    getMacro(),
    optional(dailyHistory(ticker, "5y")),
    // SEC figures are in dollars, so they only line up with a dollar price.
    !isFund && currency === "USD" ? optional(sec.getFundamentals(ticker, price)) : null,
  ]);
  const fundamentals = companyFigures ?? priceOnly(price, isFund);

  const profile: Profile = {
    name: meta.name ?? ticker,
    kind: KINDS[meta.instrumentType ?? ""] ?? null,
    isFund,
  };

  const longBars: Bar[] = fiveYears?.bars ?? year.bars;
  const metrics = assembleMetrics(fundamentals, closes, dividends, macro, longBars);
  const summary = buildSummary(closes);
  const levels = priceLevels(closes, summary);
  const volatility = safe(() => annualizedVolatility(closes));
  const var95 = safe(() => historicalVar(closes));

  return {
    ticker,
    name: profile.name,
    price,
    currency,
    isFund,
    profile,
    mood: sentiment(summary),
    entry: entryRead(summary),
    levels,
    buy: buyAnswer(summary, levels, currency),
    metrics,
    hasFundamentals: companyFigures != null,
    analytics: {
      freeCashFlow: fundamentals.freeCashFlow,
      sharesOutstanding: fundamentals.sharesOutstanding,
      volatility,
      sharpe: safe(() => sharpeRatio(closes)),
      var95,
    },
  };
}

/** Cached for five minutes and shared by every visitor. Failures aren't cached. */
export const lookup = unstable_cache(buildLookup, ["lookup-v2"], { revalidate: 300 });
