"use client";

import { useEffect, useState } from "react";

import { DEFAULT_PERIOD, HISTORY_PERIODS } from "@/lib/config";
import { fmtPrice } from "@/lib/format";
import { periodReturn } from "@/lib/analytics/technicals";
import type { Bar } from "@/lib/data/types";
import type { Lookup } from "@/lib/lookup";
import InvestorPanel from "./InvestorPanel";
import PriceChart from "./PriceChart";
import TickerForm from "./TickerForm";
import { useLookup, useTicker } from "./useTicker";

const MOOD_ICONS: Record<string, string> = { Bullish: "🟢", Neutral: "🟡", Bearish: "🔴" };
const ENTRY_ICONS: Record<string, string> = { "Good entry": "🟢", "Possible entry": "🟡", "No clear signal": "🟡", Wait: "🔴" };

export function TickerTitle({ data }: { data: Lookup }) {
  return (
    <div className="ticker-title">
      <h2>{data.name}</h2>
      <div className="price">{fmtPrice(data.price, data.currency)}</div>
      <div className="facts">{[data.ticker, data.profile.kind].filter(Boolean).join(" · ")}</div>
    </div>
  );
}

function WhatItIs({ ticker }: { ticker: string }) {
  const [about, setAbout] = useState<{ text: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAbout(null);
    fetch(`/api/explain?t=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((body) => !cancelled && body.text && setAbout(body))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ticker]);
  return (
    <section>
      <h2>What it is</h2>
      {about ? (
        <>
          <p style={{ color: "var(--text)" }}>{about.text}</p>
        </>
      ) : (
        <p><span className="spinner" />Writing a plain explanation...</p>
      )}
    </section>
  );
}

function Performance({ ticker, currency }: { ticker: string; currency: string | null }) {
  const labels = Object.keys(HISTORY_PERIODS);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [candles, setCandles] = useState(false);
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBars(null);
    setError(null);
    fetch(`/api/history?t=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}`)
      .then(async (r) => {
        const body = await r.json();
        if (cancelled) return;
        if (r.ok) setBars(body.bars);
        else setError(body.error ?? "No price chart for this timeframe.");
      })
      .catch(() => !cancelled && setError("No price chart for this timeframe."));
    return () => {
      cancelled = true;
    };
  }, [ticker, period]);

  const closes = bars?.map((b) => b.close) ?? [];
  const change = closes.length >= 2 ? periodReturn(closes) : null;
  const perShare = change != null ? closes[closes.length - 1] - closes[0] : null;
  const span = period.replace(/^1 /, "");
  return (
    <section>
      <h2>How it has done</h2>
      <div className="pills">
        {labels.map((label) => (
          <button key={label} className="pill" aria-pressed={label === period} onClick={() => setPeriod(label)}>
            {label}
          </button>
        ))}
      </div>
      {change != null && perShare != null && (
        <>
          <div className={`move ${change >= 0 ? "up" : "down"}`}>
            {change >= 0 ? "Up" : "Down"} {fmtPrice(Math.abs(perShare), currency)} a share over the past {span}
          </div>
          <p style={{ color: "var(--text)", marginTop: 4 }}>
            {fmtPrice(1000, currency)} put in {period.startsWith("1 ") ? `a ${span}` : span} ago would be about {fmtPrice(1000 * (1 + change), currency)} today.
          </p>
        </>
      )}
      <label className="toggle">
        <input type="checkbox" checked={candles} onChange={(e) => setCandles(e.target.checked)} /> Show candlesticks
      </label>
      {error && <div className="notice error">{error}</div>}
      {bars ? <PriceChart bars={bars} candles={candles} intraday={HISTORY_PERIODS[period][1] !== "1d"} /> : !error && <div className="chart" />}
    </section>
  );
}

function GoodTime({ data }: { data: Lookup }) {
  return (
    <section>
      <h2>Is now a good time?</h2>
      <div className="buy">Should I buy today? {data.buy.answer}.</div>
      {data.buy.nextStep && <p style={{ color: "var(--text)", marginTop: 4 }}>{data.buy.nextStep}</p>}
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Trend right now</div>
          <div className="metric-value">{MOOD_ICONS[data.mood.label]} {data.mood.label}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Entry point</div>
          <div className="metric-value">{ENTRY_ICONS[data.entry.label]} {data.entry.label}</div>
        </div>
      </div>
      <p style={{ color: "var(--text)" }}>{data.entry.why}</p>
      <p className="small">
        Prices to watch come from past price moves. They are not predictions. Information only, not financial advice.
      </p>
    </section>
  );
}

export default function Dashboard() {
  const [ticker, setTicker] = useTicker();
  const { data, error, loading } = useLookup(ticker);
  return (
    <>
      <TickerForm label="Enter a stock or fund ticker" ticker={ticker} onSubmit={setTicker} />
      {loading && <p><span className="spinner" />Looking up {ticker}...</p>}
      {error && <div className="notice error">{error}</div>}
      {data && (
        <>
          <TickerTitle data={data} />
          <WhatItIs ticker={data.ticker} />
          <Performance ticker={data.ticker} currency={data.currency} />
          <GoodTime data={data} />
          <InvestorPanel key={data.ticker} ticker={data.ticker} />
        </>
      )}
    </>
  );
}
