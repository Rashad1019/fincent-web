import "server-only";

import { CACHE_SECONDS } from "../config";
import { DataSourceError } from "./errors";
import type { Fundamentals } from "./types";

// Company figures from the SEC's free public data: every US-listed company's
// filed profit, debt, and cash flow. No account or key. The SEC asks every
// caller to name a contact email, which is read from SEC_CONTACT_EMAIL so it
// never sits in the public code. Without it, company figures are skipped.

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";
const TIMEOUT_MS = 20_000;

export type Fact = { start?: string; end: string; val: number; fy?: number; fp?: string; form?: string };
export type CompanyFacts = { facts?: Record<string, Record<string, { units?: Record<string, Fact[]> }>> };

function userAgent(): string {
  const email = process.env.SEC_CONTACT_EMAIL?.trim();
  if (!email) throw new DataSourceError("SEC_CONTACT_EMAIL is not set");
  return `Fincent ${email}`;
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS.profile },
    });
  } catch (error) {
    if (error instanceof DataSourceError) throw error;
    throw new DataSourceError(`SEC request failed: ${(error as Error).name}`);
  }
  if (!response.ok) throw new DataSourceError(`SEC request failed: HTTP ${response.status}`);
  return response.json();
}

/** The SEC's 10-digit company number for a ticker, or null if it doesn't file with the SEC. */
async function cikFor(ticker: string): Promise<string | null> {
  const table = (await getJson(TICKERS_URL)) as Record<string, { cik_str: number; ticker: string }>;
  const wanted = ticker.toUpperCase();
  const row = Object.values(table).find((entry) => entry.ticker?.toUpperCase() === wanted);
  return row ? String(row.cik_str).padStart(10, "0") : null;
}

const DAY_MS = 86_400_000;
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / DAY_MS;

function facts(company: CompanyFacts, taxonomy: string, concept: string, unit: string): Fact[] {
  return company.facts?.[taxonomy]?.[concept]?.units?.[unit] ?? [];
}

/** Full-year figures from annual reports, newest first, one per year. */
export function annual(company: CompanyFacts, concepts: string[], unit = "USD"): Fact[] {
  // Companies change which name they file under, so take whichever is newest.
  let best: Fact[] = [];
  for (const concept of concepts) {
    const rows = facts(company, "us-gaap", concept, unit).filter(
      (f) => f.start && f.form?.startsWith("10-K") && days(f.start, f.end) > 350 && days(f.start, f.end) < 380,
    );
    const byEnd = new Map<string, Fact>();
    for (const row of rows) byEnd.set(row.end, row); // later filings correct earlier ones
    const sorted = [...byEnd.values()].sort((a, b) => b.end.localeCompare(a.end));
    if (sorted.length && (!best.length || sorted[0].end > best[0].end)) best = sorted;
  }
  return best;
}

/** The most recent balance-sheet figure from any annual or quarterly report. */
export function latest(company: CompanyFacts, concepts: string[], unit = "USD", taxonomy = "us-gaap"): Fact | null {
  let best: Fact | null = null;
  for (const concept of concepts) {
    for (const row of facts(company, taxonomy, concept, unit)) {
      if (row.start || !(row.form?.startsWith("10-K") || row.form?.startsWith("10-Q"))) continue;
      if (!best || row.end > best.end) best = row;
    }
  }
  return best;
}

/** Sum of the debt lines reported on the newest balance-sheet date. */
function totalDebt(company: CompanyFacts): number | null {
  const total = latest(company, ["LongTermDebt", "DebtInstrumentCarryingAmount"]);
  const parts = ["LongTermDebtNoncurrent", "LongTermDebtCurrent", "CommercialPaper", "ShortTermBorrowings"].map((c) =>
    latest(company, [c]),
  );
  const newest = [total, ...parts].reduce<string | null>((end, f) => (f && (!end || f.end > end) ? f.end : end), null);
  if (!newest) return null;
  const onDate = (f: Fact | null) => (f && f.end === newest ? f.val : 0);
  const longTerm = total && total.end === newest ? total.val : onDate(parts[0]) + onDate(parts[1]);
  return longTerm + onDate(parts[2]) + onDate(parts[3]);
}

const NET_INCOME = ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"];
const REVENUE = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
];

/** Company figures from the latest annual report, plus shares from the latest filing. Pure, for tests. */
export function fundamentalsFrom(company: CompanyFacts, price: number): Fundamentals | null {
  const income = annual(company, NET_INCOME);
  if (!income.length) return null;
  const revenue = annual(company, REVENUE)[0]?.val ?? null;
  const cash = annual(company, ["NetCashProvidedByUsedInOperatingActivities"])[0]?.val;
  const capex = annual(company, ["PaymentsToAcquirePropertyPlantAndEquipment"])[0]?.val ?? 0;
  const dividendsPaid = annual(company, ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"])[0]?.val ?? null;
  const eps = annual(company, ["EarningsPerShareDiluted", "EarningsPerShareBasic"], "USD/shares");
  const equity = latest(company, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]);
  const shares =
    latest(company, ["EntityCommonStockSharesOutstanding"], "shares", "dei")?.val ??
    annual(company, ["WeightedAverageNumberOfDilutedSharesOutstanding"], "shares")[0]?.val ??
    null;

  const netIncome = income[0].val;
  const growth =
    eps.length >= 2 && eps[1].val !== 0 && days(eps[1].end, eps[0].end) < 380
      ? (eps[0].val - eps[1].val) / Math.abs(eps[1].val)
      : null;

  return {
    price,
    isFund: false,
    marketCap: shares ? shares * price : null,
    eps: eps[0]?.val ?? null,
    dividendYield: null, // worked out from Yahoo's payout history instead
    payoutRatio: dividendsPaid != null && netIncome > 0 ? dividendsPaid / netIncome : null,
    bookValuePerShare: equity && shares ? equity.val / shares : null,
    netIncome,
    shareholderEquity: equity?.val ?? null,
    totalDebt: totalDebt(company),
    revenue,
    freeCashFlow: cash != null ? cash - capex : null,
    sharesOutstanding: shares,
    earningsGrowth: growth,
  };
}

/**
 * Company figures for a US-listed company priced in dollars. Throws
 * DataSourceError for funds, foreign companies, or when the SEC can't be reached.
 */
export async function getFundamentals(ticker: string, price: number): Promise<Fundamentals> {
  const cik = await cikFor(ticker);
  if (!cik) throw new DataSourceError(`${ticker} does not file with the SEC`);
  const company = (await getJson(`${FACTS_URL}/CIK${cik}.json`)) as CompanyFacts;
  const figures = fundamentalsFrom(company, price);
  if (!figures) throw new DataSourceError(`The SEC has no annual figures for ${ticker}`);
  return figures;
}
