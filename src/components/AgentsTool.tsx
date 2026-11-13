"use client";

import { TickerTitle } from "./Dashboard";
import InvestorPanel, { ProfilesList } from "./InvestorPanel";
import TickerForm from "./TickerForm";
import { useLookup, useTicker } from "./useTicker";

export default function AgentsTool() {
  const [ticker, setTicker] = useTicker();
  const { data, error, loading } = useLookup(ticker);
  return (
    <>
      <TickerForm label="Ticker" ticker={ticker} onSubmit={setTicker} />
      {!ticker && <ProfilesList open />}
      {loading && <p><span className="spinner" />Computing metrics for {ticker}...</p>}
      {error && <div className="notice error">{error}</div>}
      {data && (
        <>
          <TickerTitle data={data} />
          {!data.hasFundamentals && (
            <div className="notice info">
              Company figures are missing. The investors will use the last price, payouts, and the risk and trend
              numbers from the price history.
            </div>
          )}
          <InvestorPanel key={data.ticker} ticker={data.ticker} />
        </>
      )}
    </>
  );
}
