import "server-only";

import { DataSourceError } from "./errors";
import type { Bar, ChartMeta, Dividend, History } from "./types";

// Yahoo's public chart endpoint. No key, and it kept working on hosted
// servers when Yahoo's other endpoints were blocked.
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const HEADERS = { "User-Agent": "Mozilla/5.0" };
const TIMEOUT_MS = 20_000;

const VALID_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"]);
const VALID_INTERVALS = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "1d", "1mo"]);

type ChartPayload = {
  chart?: {
    result?: Array<{
      meta?: Record<string, unknown>;
      timestamp?: number[];
      indicators?: { quote?: Array<Record<string, Array<number | null>>> };
      events?: { dividends?: Record<string, { date: number; amount: number }> };
    }>;
    error?: { description?: string } | null;
  };
};

async function fetchChart(
  symbol: string,
  params: Record<string, string>,
  revalidate: number,
): Promise<NonNullable<NonNullable<ChartPayload["chart"]>["result"]>[number]> {
  const url = `${CHART_URL}${encodeURIComponent(symbol.toUpperCase())}?${new URLSearchParams(params)}`;
  let payload: ChartPayload;
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate },
    });
    payload = await response.json();
  } catch (error) {
    throw new DataSourceError(`Yahoo chart fetch failed for ${symbol}: ${(error as Error).message}`);
  }
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new DataSourceError(
      `Yahoo has no data for ${symbol}: ${payload.chart?.error?.description ?? "empty result"}`,
    );
  }
  return result;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** OHLC bars and the quote details Yahoo sends alongside them. */
export async function getHistory(
  symbol: string,
  range = "1y",
  interval = "1d",
  revalidate = 900,
): Promise<History> {
  const safeRange = VALID_RANGES.has(range) ? range : "1y";
  const safeInterval = VALID_INTERVALS.has(interval) ? interval : "1d";
  const result = await fetchChart(symbol, { range: safeRange, interval: safeInterval }, revalidate);

  const quote = result.indicators?.quote?.[0] ?? {};
  const timestamps = result.timestamp ?? [];
  const bars: Bar[] = [];
  timestamps.forEach((time, i) => {
    const close = quote.close?.[i];
    if (close == null || !Number.isFinite(close)) return;
    bars.push({
      time,
      open: quote.open?.[i] ?? undefined,
      high: quote.high?.[i] ?? undefined,
      low: quote.low?.[i] ?? undefined,
      close,
    });
  });
  if (bars.length === 0) throw new DataSourceError(`Yahoo has no prices for ${symbol}`);

  const raw = result.meta ?? {};
  const meta: ChartMeta = {
    symbol: text(raw.symbol) ?? symbol.toUpperCase(),
    name: text(raw.longName) ?? text(raw.shortName),
    currency: text(raw.currency),
    price: number(raw.regularMarketPrice) ?? bars[bars.length - 1].close,
    instrumentType: text(raw.instrumentType),
  };
  return { bars, meta };
}

/** Cash dividends, oldest first. Empty when there are none. */
export async function getDividends(symbol: string, revalidate = 6 * 3600): Promise<Dividend[]> {
  const result = await fetchChart(
    symbol,
    { range: "max", interval: "1mo", events: "div" },
    revalidate,
  );
  return Object.values(result.events?.dividends ?? {})
    .map((event) => ({ time: event.date, amount: Number(event.amount) }))
    .filter((event) => Number.isFinite(event.amount))
    .sort((a, b) => a.time - b.time);
}

export const FUND_TYPES = new Set(["ETF", "MUTUALFUND"]);
export const KINDS: Record<string, string> = {
  ETF: "ETF",
  MUTUALFUND: "Mutual fund",
  EQUITY: "Stock",
};
