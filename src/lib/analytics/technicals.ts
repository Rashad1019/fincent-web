// Trend and entry readings from daily closes. Indicators return null when there
// isn't enough history, and the rules treat null as "no opinion".
// These read the chart, not the business, and the page says so.

import { fmtPrice } from "../format";

export const RSI_PERIOD = 14;
export const RSI_OVERSOLD = 30;
export const RSI_OVERBOUGHT = 70;
export const RSI_PULLBACK_CEILING = 45;
const TRADING_DAYS_PER_MONTH = 21;
const RECENT_LOW_BARS = 63; // about three months of trading days
const MIN_DIP = 0.01; // a better price has to be worth waiting for
const BULLISH_SCORE = 2;
const BEARISH_SCORE = -2;

export type Summary = {
  price: number;
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  return1mo: number | null;
};

/** pandas' ewm(alpha, adjust=True).mean() at the last point. */
function ewmLast(values: number[], alpha: number): number {
  let weighted = 0;
  let weights = 0;
  let weight = 1;
  for (let i = values.length - 1; i >= 0; i--) {
    weighted += weight * values[i];
    weights += weight;
    weight *= 1 - alpha;
  }
  return weighted / weights;
}

/** Relative Strength Index with Wilder's smoothing, 0-100, or null. */
export function rsi(prices: number[], period = RSI_PERIOD): number | null {
  if (prices.length < period + 1) return null;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }
  const avgGain = ewmLast(gains, 1 / period);
  const avgLoss = ewmLast(losses, 1 / period);
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function sma(prices: number[], window: number): number | null {
  if (prices.length < window) return null;
  const slice = prices.slice(-window);
  return slice.reduce((sum, p) => sum + p, 0) / window;
}

export function buildSummary(prices: number[]): Summary {
  let return1mo: number | null = null;
  if (prices.length > TRADING_DAYS_PER_MONTH) {
    const monthAgo = prices[prices.length - 1 - TRADING_DAYS_PER_MONTH];
    if (monthAgo) return1mo = prices[prices.length - 1] / monthAgo - 1;
  }
  return {
    price: prices[prices.length - 1],
    rsi14: rsi(prices),
    sma20: sma(prices, 20),
    sma50: sma(prices, 50),
    sma200: sma(prices, 200),
    return1mo,
  };
}

/** Change from the first price to the last, or null without two prices. */
export function periodReturn(prices: number[]): number | null {
  if (prices.length < 2 || !prices[0]) return null;
  return prices[prices.length - 1] / prices[0] - 1;
}

export type Mood = { label: "Bullish" | "Neutral" | "Bearish"; score: number; reasons: string[] };

/** Indicator votes added up into Bullish, Neutral, or Bearish. */
export function sentiment(summary: Summary): Mood {
  const { price, rsi14, return1mo } = summary;
  const votes: [number, string][] = [];
  for (const [window, average] of [
    [20, summary.sma20],
    [50, summary.sma50],
    [200, summary.sma200],
  ] as const) {
    if (average == null) continue;
    votes.push(
      price > average
        ? [1, `Price is above the ${window}-day average`]
        : [-1, `Price is below the ${window}-day average`],
    );
  }
  if (rsi14 != null) {
    if (rsi14 > 55) votes.push([1, `RSI at ${rsi14.toFixed(0)} shows positive momentum`]);
    else if (rsi14 < 45) votes.push([-1, `RSI at ${rsi14.toFixed(0)} shows negative momentum`]);
  }
  if (return1mo != null) {
    votes.push(
      return1mo > 0
        ? [1, `Up ${(return1mo * 100).toFixed(1)}% over the last month`]
        : [-1, `Down ${(Math.abs(return1mo) * 100).toFixed(1)}% over the last month`],
    );
  }
  const score = votes.reduce((sum, [vote]) => sum + vote, 0);
  const label = score >= BULLISH_SCORE ? "Bullish" : score <= BEARISH_SCORE ? "Bearish" : "Neutral";
  return { label, score, reasons: votes.map(([, reason]) => reason) };
}

export type EntryLabel = "Good entry" | "Possible entry" | "No clear signal" | "Wait";
export type Entry = { label: EntryLabel; why: string };

/**
 * One plain answer to "is this a good entry?". Warnings outrank entry
 * signals: a stretched or broken chart says wait even when another rule
 * would call it an entry.
 */
export function entryRead(summary: Summary): Entry {
  const { price, rsi14, sma50, sma200 } = summary;
  const aboveLongTerm = sma200 != null && price > sma200;

  if (rsi14 != null && rsi14 >= RSI_OVERBOUGHT) {
    return {
      label: "Wait",
      why: "The price has run up quickly. Buying after a fast rise is risky, and pullbacks are common.",
    };
  }
  if (sma200 != null && !aboveLongTerm) {
    return {
      label: "Wait",
      why: "The price is below its 200-day average, so the long-term trend is pointing down.",
    };
  }
  if (rsi14 != null && rsi14 <= RSI_PULLBACK_CEILING && aboveLongTerm) {
    return {
      label: "Possible entry",
      why:
        "The price has been falling lately, but the long-term trend is still up. That can be a " +
        "pullback worth buying, or the start of a bigger drop. Nobody knows which until later.",
    };
  }
  if (sma50 != null && sma200 != null && aboveLongTerm && sma50 > sma200 && price > sma50) {
    return { label: "Good entry", why: "The trend is up and the price is not stretched." };
  }
  return { label: "No clear signal", why: "The chart isn't saying much either way right now." };
}

export type Levels = { betterPrice: number | null; trendLine: number | null };

/**
 * Two chart prices to watch. betterPrice is the nearest of the 50-day average
 * and the three-month low that sits under today's price and above the trend
 * line. trendLine is the 200-day average. Both come from past prices and are
 * not predictions.
 */
export function priceLevels(prices: number[], summary: Summary): Levels {
  const { price, sma200: trendLine } = summary;
  const recentLow = Math.min(...prices.slice(-RECENT_LOW_BARS));
  const below = [summary.sma50, recentLow].filter(
    (level): level is number =>
      level != null && level <= price * (1 - MIN_DIP) && (trendLine == null || level > trendLine),
  );
  return { betterPrice: below.length ? Math.max(...below) : null, trendLine };
}

export type BuyAnswer = { answer: string; nextStep: string };

/** Plain answer to "should I buy today?", with the prices to watch. */
export function buyAnswer(summary: Summary, levels: Levels, currency: string | null): BuyAnswer {
  const money = (value: number) => fmtPrice(value, currency);
  const { betterPrice, trendLine } = levels;

  if (trendLine != null && summary.price <= trendLine) {
    return {
      answer: "Not yet",
      nextStep: `Wait until it climbs back above ${money(trendLine)}. That would show the long-term trend has turned up.`,
    };
  }

  const label = entryRead(summary).label;
  const answer = {
    "Good entry": "Looks reasonable",
    "Possible entry": "Maybe, but there's no rush",
    "No clear signal": "No rush",
    Wait: "Not yet",
  }[label];
  const steps: string[] = [];
  if (betterPrice != null) {
    const lead =
      label === "Good entry" ? "If you'd rather pay less, watch for around" : "A better price would be around";
    steps.push(`${lead} ${money(betterPrice)}.`);
  }
  if (trendLine != null) {
    steps.push(`If it falls below ${money(trendLine)}, the long-term trend has turned down, so hold off.`);
  }
  return { answer, nextStep: steps.join(" ") };
}
