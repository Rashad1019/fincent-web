"use client";

import { useEffect, useState } from "react";

/** Starts empty. Submitting puts the ticker in the address. */
export default function TickerForm({
  label,
  ticker,
  onSubmit,
}: {
  label: string;
  ticker: string | null;
  onSubmit: (ticker: string) => void;
}) {
  const [value, setValue] = useState(ticker ?? "");
  useEffect(() => setValue(ticker ?? ""), [ticker]);
  return (
    <form
      className="field"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <label htmlFor="ticker">{label}</label>
      <div className="ticker-row">
        <input
          id="ticker"
          className="input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Try SPY, AAPL, or QQQ"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
        />
        <button className="btn btn-primary" type="submit">
          Look up
        </button>
      </div>
    </form>
  );
}
