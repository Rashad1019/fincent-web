import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_SECONDS, RISK_RANGE } from "./config";
import { fmtMoney, fmtPct, fmtRatio } from "./format";
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
import { DataSourceError } from "./data/errors";
import * as fmp from "./data/fmp";
import { getMacro } from "./data/macro";
import type { Bar, Fundamentals, History, Profile } from "./data/types";
import { FUND_TYPES, getDividends, getHistory, KINDS } from "./data/yahoo";

export type KeyNumber = { label: string; value: string };

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
  keyNumbers: KeyNumber[];
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

/** Daily bars from Yahoo, with FMP as the backup. */
export async function dailyHistory(ticker: string, range: string, days: number): Promise<History> {
  try {
    return await getHistory(ticker, range, "1d", CACHE_SECONDS.history);
  } catch (error) {
    if (!(error instanceof DataSourceError)) throw error;
    const bars = await optional(fmp.getDailyHistory(ticker, days));
    if (!bars?.length) throw error;
    return { bars, meta: { symbol: ticker, name: null, currency: null, price: null, instrumentType: null } };
  }
}

function priceOnly(price: number, isFund: boolean, marketCap: number | null): Fundamentals {
  return {
    price,
    isFund,
    marketCap,
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
  const year = await dailyHistory(ticker, RISK_RANGE, 369);
  const [fmpProfile, dividends, macro, fiveYears] = await Promise.all([
    optional(fmp.getProfile(ticker)),
    getDividends(ticker).catch(() => []),
    getMacro(),
    optional(dailyHistory(ticker, "5y", 1830)),
  ]);

  const { meta } = year;
  const isFund = FUND_TYPES.has(meta.instrumentType ?? "") || Boolean(fmpProfile?.isFund);
  const [fundInfo, companyFigures] = await Promise.all([
    isFund ? optional(fmp.getFundInfo(ticker)) : null,
    !isFund && fmpProfile ? optional(fmp.getFundamentals(ticker, fmpProfile)) : null,
  ]);

  const closes = year.bars.map((bar) => bar.close);
  const price = meta.price ?? closes[closes.length - 1];
  const currency = meta.currency ?? fmpProfile?.currency ?? null;
  const fundamentals = companyFigures
    ? { ...companyFigures, price }
    : priceOnly(price, isFund, fmpProfile?.marketCap ?? null);

  const profile: Profile = {
    name: fmpProfile?.name ?? meta.name ?? ticker,
    kind: KINDS[meta.instrumentType ?? ""] ?? (fmpProfile ? (isFund ? "Fund" : "Stock") : null),
    summary: fmpProfile?.summary ?? null,
    family: fundInfo?.family ?? null,
    category: fundInfo?.category ?? null,
    sector: fmpProfile?.sector ?? null,
    industry: fmpProfile?.industry ?? null,
    isFund,
    expenseRatio: fundInfo?.expenseRatio ?? null,
  };

  const longBars: Bar[] = fiveYears?.bars ?? year.bars;
  const metrics = assembleMetrics(fundamentals, closes, dividends, macro, longBars);
  const summary = buildSummary(closes);
  const levels = priceLevels(closes, summary);
  const volatility = safe(() => annualizedVolatility(closes));
  const var95 = safe(() => historicalVar(closes));

  const rows: [string, number | null, (value: number) => string][] = isFund
    ? [
        ["Yearly fee", profile.expenseRatio, fmtPct],
        ["Dividend yield", metrics.dividend_yield as number | null, fmtPct],
        ["Yearly swing (volatility)", volatility, fmtPct],
        ["Bad-day loss (95%)", var95, fmtPct],
      ]
    : [
        ["Company value", fundamentals.marketCap, fmtMoney],
        ["P/E ratio", metrics.pe_ratio as number | null, fmtRatio],
        ["Dividend yield", metrics.dividend_yield as number | null, fmtPct],
        ["Profit margin", metrics.profit_margin as number | null, fmtPct],
        ["Yearly swing (volatility)", volatility, fmtPct],
        ["Bad-day loss (95%)", var95, fmtPct],
      ];

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
    keyNumbers: rows.filter(([, value]) => value != null).map(([label, value, render]) => ({ label, value: render(value!) })),
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
export const lookup = unstable_cache(buildLookup, ["lookup-v1"], { revalidate: 300 });
