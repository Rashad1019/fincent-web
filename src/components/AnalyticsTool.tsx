"use client";

import { useEffect, useState } from "react";

import { DCF } from "@/lib/config";
import { fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { dcfValue } from "@/lib/analytics/valuation";
import type { Lookup } from "@/lib/lookup";
import { TickerTitle } from "./Dashboard";
import TickerForm from "./TickerForm";
import { useLookup, useTicker } from "./useTicker";

function NumberInput({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="muted small">
      {label}
      <input className="input mono" type="number" value={Number.isFinite(value) ? value : ""} step={step}
        onChange={(e) => onChange(Number(e.target.value))} style={{ marginTop: 6 }} />
    </label>
  );
}

function DcfCalculator({ data }: { data: Lookup }) {
  const [fcf, setFcf] = useState(data.analytics.freeCashFlow ?? 0);
  const [growth, setGrowth] = useState(DCF.growth * 100);
  const [discount, setDiscount] = useState(DCF.discount * 100);
  const [terminal, setTerminal] = useState(DCF.terminalGrowth * 100);
  const [years, setYears] = useState(DCF.years);
  useEffect(() => setFcf(data.analytics.freeCashFlow ?? 0), [data]);

  let total: number | null = null;
  let error: string | null = null;
  try {
    total = dcfValue(fcf, growth / 100, discount / 100, terminal / 100, Math.round(years));
  } catch (e) {
    error = (e as Error).message;
  }
  const shares = data.analytics.sharesOutstanding;
  const perShare = total != null && shares ? total / shares : null;
  const upside = perShare != null ? (perShare - data.price) / data.price : null;

  return (
    <section>
      <h2>DCF intrinsic value</h2>
      <p className="small">Pre-filled with the company&apos;s trailing free cash flow. Adjust the assumptions.</p>
      <div className="grid-inputs">
        <NumberInput label="Free cash flow" value={fcf} onChange={setFcf} />
        <NumberInput label="Growth rate %" value={growth} onChange={setGrowth} step={0.5} />
        <NumberInput label="Discount rate %" value={discount} onChange={setDiscount} step={0.5} />
        <NumberInput label="Terminal growth %" value={terminal} onChange={setTerminal} step={0.5} />
        <NumberInput label="Years" value={years} onChange={(v) => setYears(Math.min(20, Math.max(1, v)))} />
      </div>
      {error ? (
        <div className="notice error">{error}</div>
      ) : (
        <div className="metrics">
          <div className="metric"><div className="metric-label">Intrinsic value (total)</div><div className="metric-value">{fmtMoney(total)}</div></div>
          <div className="metric"><div className="metric-label">Per share</div><div className="metric-value">{perShare != null ? fmtRatio(perShare) : "N/A (shares unknown)"}</div></div>
          <div className="metric">
            <div className="metric-label">vs. current price</div>
            <div className="metric-value">{fmtRatio(data.price)}{" "}
              {upside != null && <span className={upside >= 0 ? "up" : "down"} style={{ fontSize: "1rem" }}>{upside >= 0 ? "+" : ""}{fmtPct(upside)}</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AnalyticsTool() {
  const [ticker, setTicker] = useTicker();
  const { data, error, loading } = useLookup(ticker);
  return (
    <>
      <TickerForm label="Ticker" ticker={ticker} onSubmit={setTicker} />
      {loading && <p><span className="spinner" />Fetching {ticker}...</p>}
      {error && <div className="notice error">{error}</div>}
      {data && (
        <>
          <TickerTitle data={data} />
          {data.hasFundamentals ? (
            <DcfCalculator data={data} />
          ) : (
            <div className="notice info">The DCF needs company figures, so it isn&apos;t available for {data.ticker}. Funds don&apos;t have them.</div>
          )}
          <section>
            <h2>Risk metrics (1 year of daily prices)</h2>
            <div className="metrics">
              <div className="metric"><div className="metric-label">Annualized volatility</div><div className="metric-value">{fmtPct(data.analytics.volatility)}</div></div>
              <div className="metric"><div className="metric-label">Sharpe ratio</div><div className="metric-value">{fmtRatio(data.analytics.sharpe)}</div></div>
              <div className="metric"><div className="metric-label">1-day VaR (95%)</div><div className="metric-value">{fmtPct(data.analytics.var95)}</div></div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
