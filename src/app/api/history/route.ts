import { NextResponse } from "next/server";

import { CACHE_SECONDS, cleanTicker, HISTORY_PERIODS } from "@/lib/config";
import { getHistory } from "@/lib/data/yahoo";
import { dailyHistory } from "@/lib/lookup";

const BACKUP_DAYS: Record<string, number> = { "1mo": 32, "3mo": 95, "6mo": 189, "1y": 369, "5y": 1830 };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ticker = cleanTicker(params.get("t"));
  const period = HISTORY_PERIODS[params.get("period") ?? ""];
  if (!ticker || !period) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const [range, interval] = period;
  try {
    const history =
      interval === "1d"
        ? await dailyHistory(ticker, range, BACKUP_DAYS[range] ?? 369)
        : await getHistory(ticker, range, interval, CACHE_SECONDS.quote);
    return NextResponse.json({ bars: history.bars });
  } catch {
    return NextResponse.json({ error: "No price chart for this timeframe." }, { status: 404 });
  }
}
