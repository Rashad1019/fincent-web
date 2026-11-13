import { describe, expect, it } from "vitest";

import { annualizedVolatility, historicalVar, sharpeRatio } from "@/lib/analytics/risk";
import { buyAnswer, priceLevels, rsi, type Summary } from "@/lib/analytics/technicals";
import { dcfValue, pegRatio, peRatio, profitMargin } from "@/lib/analytics/valuation";

const chart = (price: number, sma50: number | null = null, sma200: number | null = null, rsi14 = 50): Summary => ({
  price, sma50, sma200, rsi14, sma20: null, return1mo: null,
});

describe("technicals", () => {
  it("rsi needs enough history", () => expect(rsi([100, 101, 102])).toBeNull());
  it("rsi is high for steadily rising prices", () => {
    expect(rsi(Array.from({ length: 250 }, (_, i) => 100 + i * 0.4))).toBeGreaterThan(70);
  });
  it("price levels pick the nearest level above the trend line", () => {
    const prices = [...Array(60).fill(100), 95, 100, 100];
    expect(priceLevels(prices, chart(100, 98, 90))).toEqual({ betterPrice: 98, trendLine: 90 });
  });
  it("price levels skip a dip too small to wait for", () => {
    expect(priceLevels(Array(70).fill(100), chart(100, 99.5, 90)).betterPrice).toBeNull();
  });
  it("price levels never offer a price under the trend line", () => {
    expect(priceLevels([85, ...Array(62).fill(100)], chart(100, 99.9, 90)).betterPrice).toBeNull();
  });
  it("below the trend, the buy answer says when to look again", () => {
    const result = buyAnswer(chart(80, 85, 90), { betterPrice: null, trendLine: 90 }, "USD");
    expect(result.answer).toBe("Not yet");
    expect(result.nextStep).toContain("climbs back above 90.00 USD");
  });
  it("works without enough history", () => {
    expect(buyAnswer(chart(100), { betterPrice: null, trendLine: null }, null)).toEqual({ answer: "No rush", nextStep: "" });
  });
});

describe("risk", () => {
  it("constant prices have zero volatility and no Sharpe", () => {
    expect(annualizedVolatility(Array(30).fill(100))).toBe(0);
    expect(sharpeRatio(Array(30).fill(100))).toBeNull();
  });
  it("volatility matches a hand calculation", () => {
    expect(annualizedVolatility([100, 110, 99])).toBeCloseTo(Math.sqrt(0.02) * Math.sqrt(252), 10);
  });
  it("needs two prices", () => expect(() => annualizedVolatility([100])).toThrow());
  it("value at risk is a positive loss", () => expect(historicalVar([100, 90, 81, 72.9])).toBeCloseTo(0.1, 10));
});

describe("valuation", () => {
  it("dcf matches a one-year hand calculation", () => {
    const fcf = 100 * 1.1;
    const expected = fcf / 1.1 + (fcf * 1.02) / (0.1 - 0.02) / 1.1;
    expect(dcfValue(100, 0.1, 0.1, 0.02, 1)).toBeCloseTo(expected, 8);
  });
  it("dcf rejects a discount rate at or below terminal growth", () => {
    expect(() => dcfValue(100, 0.05, 0.02, 0.02)).toThrow();
  });
  it("ratios are null when undefined", () => {
    expect(peRatio(100, 0)).toBeNull();
    expect(peRatio(100, -1)).toBeNull();
    expect(profitMargin(10, 0)).toBeNull();
    expect(pegRatio(20, -0.1)).toBeNull();
  });
  it("peg uses growth in percentage points", () => expect(pegRatio(20, 0.1)).toBe(2));
});
