// The JavaScript port must match the original Python on the same data.
// Expected values come from tests/parity-fixture.json, made by running
// fintime's analytics on these exact series.
import { describe, expect, it } from "vitest";

import fixture from "./parity-fixture.json";
import { bestYield } from "@/lib/agents/metrics";
import { dividendYieldRange, trailingYield } from "@/lib/analytics/dividends";
import { annualizedVolatility, historicalVar, sharpeRatio } from "@/lib/analytics/risk";
import { buildSummary, buyAnswer, entryRead, priceLevels, sentiment } from "@/lib/analytics/technicals";

type Case = {
  prices: number[];
  summary: Record<string, number | null>;
  sentiment: { label: string; score: number; reasons: string[] };
  entry: { label: string; why: string };
  levels: { better_price: number | null; trend_line: number | null };
  buy: { answer: string; next_step: string };
  vol: number;
  sharpe: number | null;
  var: number;
};

const close = (actual: number | null, expected: number | null) => {
  if (expected == null) expect(actual).toBeNull();
  else expect(actual).toBeCloseTo(expected, 9);
};

for (const name of ["noisy", "rising", "pullback", "short"] as const) {
  const c = (fixture as unknown as Record<string, Case>)[name];
  describe(`${name} series matches Python`, () => {
    const summary = buildSummary(c.prices);
    it("summary", () => {
      close(summary.price, c.summary.price);
      close(summary.rsi14, c.summary.rsi_14);
      close(summary.sma20, c.summary.sma_20);
      close(summary.sma50, c.summary.sma_50);
      close(summary.sma200, c.summary.sma_200);
      close(summary.return1mo, c.summary.return_1mo);
    });
    it("trend, entry, levels, and buy answer", () => {
      const mood = sentiment(summary);
      expect(mood.label).toBe(c.sentiment.label);
      expect(mood.score).toBe(c.sentiment.score);
      expect(mood.reasons).toEqual(c.sentiment.reasons);
      expect(entryRead(summary)).toEqual(c.entry);
      const levels = priceLevels(c.prices, summary);
      close(levels.betterPrice, c.levels.better_price);
      close(levels.trendLine, c.levels.trend_line);
      // Same wording as Python; prices now read "$733.00" instead of "733.00 USD".
      const dollars = (text: string) => text.replace(/([\d,]+\.\d{2}) USD/g, (_, n) => `$${n}`);
      expect(buyAnswer(summary, levels, "USD")).toEqual({ answer: c.buy.answer, nextStep: dollars(c.buy.next_step) });
    });
    it("risk", () => {
      close(annualizedVolatility(c.prices), c.vol);
      close(sharpeRatio(c.prices), c.sharpe);
      close(historicalVar(c.prices), c.var);
    });
  });
}

describe("dividends match Python", () => {
  const d = fixture.dividends;
  const bars = d.bars.map(([time, close]) => ({ time, close }));
  const divs = d.divs.map(([time, amount]) => ({ time, amount }));
  it("yield range", () => {
    const range = dividendYieldRange(bars, divs);
    close(range?.low ?? null, d.range!.dividend_yield_low);
    close(range?.high ?? null, d.range!.dividend_yield_high);
  });
  it("trailing yield", () => close(trailingYield(100, divs, d.asof), d.trailing));
  it("best yield", () => {
    for (const [reported, paid, isFund, expected] of fixture.best_yield as [number | null, number | null, boolean, number | null][]) {
      close(bestYield(reported, paid, isFund), expected);
    }
  });
});
