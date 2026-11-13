/** One price bar. time is Unix seconds, as Yahoo and the chart library use. */
export type Bar = {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close: number;
};

export type Dividend = { time: number; amount: number };

export type ChartMeta = {
  symbol: string;
  name: string | null;
  currency: string | null;
  price: number | null;
  instrumentType: string | null;
};

export type History = { bars: Bar[]; meta: ChartMeta };

/** Company figures. Any field can be null when a source doesn't have it. */
export type Fundamentals = {
  price: number;
  isFund: boolean;
  marketCap: number | null;
  eps: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  bookValuePerShare: number | null;
  netIncome: number | null;
  shareholderEquity: number | null;
  totalDebt: number | null;
  revenue: number | null;
  freeCashFlow: number | null;
  sharesOutstanding: number | null;
  earningsGrowth: number | null;
};

export type Profile = {
  name: string;
  kind: string | null;
  summary: string | null;
  family: string | null;
  category: string | null;
  sector: string | null;
  industry: string | null;
  isFund: boolean;
  /** Fraction: 0.0003 = 0.03% a year. */
  expenseRatio: number | null;
};
