import { NextResponse } from "next/server";

import { CACHE_SECONDS, cleanTicker, HISTORY_PERIODS } from "@/lib/config";
import { getHistory } from "@/lib/data/yahoo";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ticker = cleanTicker(params.get("t"));
  const period = HISTORY_PERIODS[params.get("period") ?? ""];
  if (!ticker || !period) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const [range, interval] = period;
  try {
    const cache = interval === "1d" ? CACHE_SECONDS.history : CACHE_SECONDS.quote;
    const history = await getHistory(ticker, range, interval, cache);
    return NextResponse.json({ bars: history.bars });
  } catch {
    return NextResponse.json({ error: "No price chart for this timeframe." }, { status: 404 });
  }
}
