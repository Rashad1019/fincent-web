// The prompt every persona receives: the ticker's real numbers, then the
// instructions for a short, plain answer. Labels and instructions were
// generated from fintime/agents/personas.py.

import { fmtPct, fmtRatio } from "../format";

export type Metrics = Record<string, number | string | null>;

export const METRIC_LABELS: Record<string, string> = {
  "price": "Current price",
  "market_cap": "Market cap",
  "pe_ratio": "P/E ratio",
  "pb_ratio": "P/B ratio",
  "roe": "Return on equity",
  "debt_to_equity": "Debt-to-equity",
  "profit_margin": "Net profit margin",
  "dividend_yield": "Dividend yield",
  "dividend_yield_paid": "Dividend yield, last 12 months of payouts",
  "payout_ratio": "Dividend payout ratio",
  "revenue": "Revenue (TTM)",
  "net_income": "Net income (TTM)",
  "free_cash_flow": "Free cash flow (TTM)",
  "eps": "EPS (TTM)",
  "earnings_growth": "Earnings growth",
  "peg_ratio": "PEG ratio",
  "dcf_value_per_share": "DCF value per share (base case)",
  "dcf_conservative_per_share": "DCF value per share (slow-growth case)",
  "dividend_yield_low": "Dividend yield, historical low",
  "dividend_yield_high": "Dividend yield, historical high",
  "ten_year_yield": "10-year Treasury yield",
  "inflation_yoy": "Inflation, year over year",
  "annualized_volatility": "Annualized volatility",
  "sharpe_ratio": "Sharpe ratio",
  "historical_var_95": "1-day VaR (95%)",
  "rsi_14": "RSI (14-day)",
  "return_1mo": "1-month price return",
  "technical_sentiment": "Technical sentiment",
  "better_price": "Better price to wait for",
  "trend_line": "Long-term trend line (200-day average)"
};

// Stored as fractions (0.0325 = 3.25%) and shown as percentages.
const PERCENT_METRICS = new Set([
  "annualized_volatility",
  "dividend_yield",
  "dividend_yield_high",
  "dividend_yield_low",
  "dividend_yield_paid",
  "earnings_growth",
  "historical_var_95",
  "inflation_yoy",
  "payout_ratio",
  "profit_margin",
  "return_1mo",
  "roe",
  "ten_year_yield"
]);

const INSTRUCTIONS = [
  "Base your answer on only the numbers provided above. Do not invent figures. Missing values are marked N/A. If one you would normally use is missing, move on without dwelling on it.",
  "Your reader has never invested before and just heard about this stock or fund. Use everyday words, as if talking to a friend. Avoid finance terms such as P/E, RSI, DCF, moat, or margin of safety. If you need one, explain it in the same sentence.",
  "Stay true to how you think, write in the first person, and keep the whole answer under 100 words.",
  "Use exactly these four parts, with these bold labels:",
  "**My take:** one sentence on how you see it.",
  "**My move:** what you would do today: buy now, wait, or skip. If you would wait, say what you are waiting for. Any price you name must be the current price, the better price to wait for, or the long-term trend line listed above.",
  "**Why:** two or three short sentences.",
  "**What could go wrong:** one sentence.",
  "End with one line and nothing after it, in exactly this form: VERDICT: WAIT | conviction 7",
  "The verdict must be BUY NOW, WAIT, or SKIP, and it must match your move. Conviction runs from 1 to 10."
];

function formatValue(key: string, value: number | string | null): string {
  if (PERCENT_METRICS.has(key)) return fmtPct(value as number | null);
  if (value == null || typeof value === "number") return fmtRatio(value);
  return value;
}

export function buildPrompt(ticker: string, metrics: Metrics): string {
  const lines = [`Analyze ${ticker} using the following computed data:`, ""];
  for (const [key, value] of Object.entries(metrics)) {
    lines.push(`- ${METRIC_LABELS[key] ?? key}: ${formatValue(key, value)}`);
  }
  return [...lines, "", ...INSTRUCTIONS].join("\n");
}
