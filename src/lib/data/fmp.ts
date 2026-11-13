import "server-only";

import { CACHE_SECONDS } from "../config";
import { DataSourceError } from "./errors";
import { rate } from "./fx";
import type { Bar, Fundamentals } from "./types";

// Financial Modeling Prep: company figures, fund details, and a price backup.
const BASE_URL = "https://financialmodelingprep.com/stable";
const TIMEOUT_MS = 20_000;

type Row = Record<string, unknown>;

function apiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new DataSourceError("FMP_API_KEY is not set");
  return key;
}

async function get(path: string, params: Record<string, string>, revalidate: number): Promise<Row[]> {
  const query = new URLSearchParams({ ...params, apikey: apiKey() });
  let payload: unknown;
  try {
    const response = await fetch(`${BASE_URL}/${path}?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate },
    });
    if (!response.ok) throw new DataSourceError(`FMP ${path} failed: HTTP ${response.status}`);
    payload = await response.json();
  } catch (error) {
    if (error instanceof DataSourceError) throw error;
    // Never include the URL: it carries the API key.
    throw new DataSourceError(`FMP ${path} failed: ${(error as Error).name}`);
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const message = (payload as Row)["Error Message"];
    throw new DataSourceError(`FMP ${path} error: ${String(message ?? "unexpected reply").slice(0, 200)}`);
  }
  return (payload as Row[]) ?? [];
}

async function first(path: string, symbol: string, revalidate: number, extra: Record<string, string> = {}): Promise<Row> {
  const rows = await get(path, { symbol, ...extra }, revalidate);
  if (!rows.length) throw new DataSourceError(`FMP has no ${path} data for ${symbol}`);
  return rows[0];
}

function num(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export type FmpProfile = {
  name: string;
  isFund: boolean;
  summary: string | null;
  sector: string | null;
  industry: string | null;
  price: number | null;
  currency: string | null;
  marketCap: number | null;
};

export async function getProfile(symbol: string): Promise<FmpProfile> {
  const row = await first("profile", symbol, CACHE_SECONDS.profile);
  return {
    name: str(row.companyName) ?? symbol,
    isFund: Boolean(row.isEtf || row.isFund),
    summary: str(row.description),
    sector: str(row.sector),
    industry: str(row.industry),
    price: num(row.price),
    currency: str(row.currency),
    marketCap: num(row.marketCap),
  };
}

export type FundInfo = { expenseRatio: number | null; family: string | null; category: string | null };

/**
 * Fee and family for a fund. FMP quotes expenseRatio in percentage points
 * (0.03 means 0.03%), so it is divided by 100 here. Check this against a
 * known fund such as IVV (0.03%) when reviewing.
 */
export async function getFundInfo(symbol: string): Promise<FundInfo> {
  const row = await first("etf/info", symbol, CACHE_SECONDS.profile);
  const expense = num(row.expenseRatio);
  return {
    expenseRatio: expense == null ? null : expense / 100,
    family: str(row.etfCompany),
    category: str(row.assetClass),
  };
}

export type Holding = { symbol: string; weight: number };

/** A fund's holdings with weights as fractions. Needs an FMP plan that includes them. */
export async function getHoldings(symbol: string): Promise<Holding[]> {
  const rows = await get("etf/holdings", { symbol }, CACHE_SECONDS.profile);
  return rows
    .map((row) => ({
      symbol: str(row.asset) ?? str(row.symbol) ?? "",
      weight: (num(row.weightPercentage) ?? 0) / 100,
    }))
    .filter((holding) => holding.symbol && holding.weight > 0);
}

function earningsGrowth(incomeRows: Row[]): number | null {
  if (incomeRows.length < 2) return null;
  const newer = num(incomeRows[0].eps);
  const older = num(incomeRows[1].eps);
  if (newer == null || older == null || older === 0) return null;
  return (newer - older) / Math.abs(older);
}

/** Company figures from the latest annual statements, in the trading currency. */
export async function getFundamentals(symbol: string, profile: FmpProfile): Promise<Fundamentals> {
  const revalidate = CACHE_SECONDS.profile;
  const [incomeRows, balance, cashFlow, ratios] = await Promise.all([
    get("income-statement", { symbol, limit: "2" }, revalidate),
    first("balance-sheet-statement", symbol, revalidate, { limit: "1" }),
    first("cash-flow-statement", symbol, revalidate, { limit: "1" }),
    first("ratios", symbol, revalidate, { limit: "1" }),
  ]);
  if (!incomeRows.length) throw new DataSourceError(`FMP has no income statement for ${symbol}`);
  if (profile.price == null) throw new DataSourceError(`FMP has no price for ${symbol}`);
  const income = incomeRows[0];
  const price = profile.price;

  const fxRate = await rate(str(income.reportedCurrency), profile.currency);
  const converted = (value: unknown) => {
    const n = num(value);
    return n == null || fxRate == null ? null : n * fxRate;
  };

  // Market cap over price counts every share class in trading units, so an
  // ADR's per-share figures line up with its price.
  const shares = profile.marketCap ? profile.marketCap / price : num(income.weightedAverageShsOut);
  const netIncome = converted(income.netIncome);
  const equity = converted(balance.totalStockholdersEquity);
  let eps = num(income.eps);
  if (fxRate !== 1) {
    // Reported EPS is per ordinary share in the reporting currency.
    eps = netIncome != null && shares ? netIncome / shares : null;
  }

  return {
    price,
    isFund: profile.isFund,
    marketCap: profile.marketCap,
    eps,
    dividendYield: num(ratios.dividendYield),
    payoutRatio: num(ratios.dividendPayoutRatio),
    bookValuePerShare: equity != null && shares ? equity / shares : null,
    netIncome,
    shareholderEquity: equity,
    totalDebt: converted(balance.totalDebt),
    revenue: converted(income.revenue),
    freeCashFlow: converted(cashFlow.freeCashFlow),
    sharesOutstanding: shares,
    earningsGrowth: earningsGrowth(incomeRows),
  };
}

/** Daily closes from FMP, used when Yahoo's chart feed fails. Oldest first. */
export async function getDailyHistory(symbol: string, days: number): Promise<Bar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const rows = await get(
    "historical-price-eod/full",
    { symbol, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    CACHE_SECONDS.history,
  );
  return rows
    .map((row) => ({
      time: Math.floor(new Date(String(row.date)).getTime() / 1000),
      open: num(row.open) ?? undefined,
      high: num(row.high) ?? undefined,
      low: num(row.low) ?? undefined,
      close: num(row.close) ?? NaN,
    }))
    .filter((bar) => Number.isFinite(bar.close) && Number.isFinite(bar.time))
    .sort((a, b) => a.time - b.time);
}
