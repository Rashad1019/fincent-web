"use client";

import { useEffect, useRef } from "react";
import type { UTCTimestamp } from "lightweight-charts";

import type { Bar } from "@/lib/data/types";

/** Line chart, or candlesticks when the bars have open, high, and low. */
export default function PriceChart({ bars, candles, intraday }: { bars: Bar[]; candles: boolean; intraday: boolean }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || bars.length === 0) return;
    let disposed = false;
    let remove = () => {};

    import("lightweight-charts").then(({ createChart }) => {
      if (disposed || !container.current) return;
      const chart = createChart(container.current, {
        autoSize: true,
        layout: { background: { color: "#0b0b0d" }, textColor: "#99999f", fontFamily: "Manrope, sans-serif" },
        grid: { vertLines: { color: "rgba(42, 42, 48, 0.6)" }, horzLines: { color: "rgba(42, 42, 48, 0.6)" } },
        rightPriceScale: { borderColor: "#2a2a30" },
        timeScale: { borderColor: "#2a2a30", timeVisible: intraday, secondsVisible: false },
      });
      const ohlc = bars.every((b) => b.open != null && b.high != null && b.low != null);
      if (candles && ohlc) {
        chart
          .addCandlestickSeries({
            upColor: "#4bd49b",
            downColor: "#f26d7d",
            borderVisible: false,
            wickUpColor: "#4bd49b",
            wickDownColor: "#f26d7d",
          })
          .setData(
            bars.map((b) => ({ time: b.time as UTCTimestamp, open: b.open!, high: b.high!, low: b.low!, close: b.close })),
          );
      } else {
        chart
          .addLineSeries({ color: "#8e96ff", lineWidth: 2 })
          .setData(bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));
      }
      chart.timeScale().fitContent();
      remove = () => chart.remove();
    });

    return () => {
      disposed = true;
      remove();
    };
  }, [bars, candles, intraday]);

  return <div className="chart" ref={container} />;
}
