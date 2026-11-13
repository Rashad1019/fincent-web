// Dividend yields from actual payouts. Yahoo's reported yield field is wrong
// for some funds (QQQI read 0.11% on a mid-teens payout), so payouts win.

import type { Bar, Dividend } from "../data/types";

const DAY = 86_400;
// Measured back from a payout date, so twelve monthly or four quarterly
// payouts fit, and slightly under a year so a drifting quarterly payer can't land five.
export const TRAILING_WINDOW_DAYS = 350;
// A payer that has been quiet this long has stopped; annual dates can drift.
export const STOPPED_AFTER_DAYS = 380;

const dayOf = (time: number) => Math.floor(time / DAY) * DAY;

/**
 * The year of dividends up to the latest payout, divided by price. null
 * without a price, when payouts have stopped, or with under a year of payout
 * history, since a partial year understates the yield.
 */
export function trailingYield(
  price: number | null,
  dividends: Dividend[],
  asOf: number = Date.now() / 1000,
): number | null {
  if (!price || price <= 0 || dividends.length === 0) return null;
  const paidSoFar = dividends.filter((d) => dayOf(d.time) <= asOf);
  if (!paidSoFar.length || dayOf(paidSoFar[0].time) > asOf - 365 * DAY) return null;
  const latest = dayOf(paidSoFar[paidSoFar.length - 1].time);
  if (asOf - latest > STOPPED_AFTER_DAYS * DAY) return null;
  const paid = paidSoFar
    .filter((d) => dayOf(d.time) > latest - TRAILING_WINDOW_DAYS * DAY)
    .reduce((sum, d) => sum + d.amount, 0);
  return paid > 0 ? paid / price : null;
}

/**
 * Low and high trailing-year yield over the price history. Prices must be
 * raw closes: dividend-adjusted ones overstate past yields. Days in the
 * first year of payouts are skipped. null without enough history.
 */
export function dividendYieldRange(
  bars: Bar[],
  dividends: Dividend[],
): { low: number; high: number } | null {
  if (bars.length < 2 || dividends.length === 0) return null;

  const priceByDay = new Map<number, number>();
  for (const bar of bars) priceByDay.set(dayOf(bar.time), bar.close);
  const paidByDay = new Map<number, number>();
  for (const d of dividends) paidByDay.set(dayOf(d.time), (paidByDay.get(dayOf(d.time)) ?? 0) + d.amount);

  const payoutDays = [...paidByDay.keys()].sort((a, b) => a - b);
  const calendar = [...new Set([...priceByDay.keys(), ...payoutDays])].sort((a, b) => a - b);
  const fullYearFrom = payoutDays[0] + 365 * DAY;

  const yields: number[] = [];
  let price: number | undefined;
  let trailing: number | undefined;
  let lastPaid: number | undefined;
  for (const day of calendar) {
    price = priceByDay.get(day) ?? price;
    if (paidByDay.has(day)) {
      lastPaid = day;
      trailing = payoutDays
        .filter((p) => p > day - TRAILING_WINDOW_DAYS * DAY && p <= day)
        .reduce((sum, p) => sum + paidByDay.get(p)!, 0);
    }
    if (price == null || trailing == null || lastPaid == null) continue;
    if (day - lastPaid > STOPPED_AFTER_DAYS * DAY || day < fullYearFrom) continue;
    const value = trailing / price;
    if (Number.isFinite(value) && value > 0) yields.push(value);
  }
  if (yields.length < 30) return null;
  return { low: Math.min(...yields), high: Math.max(...yields) };
}
