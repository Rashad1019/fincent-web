import { NextResponse } from "next/server";

import { cleanTicker } from "@/lib/config";
import { lookup } from "@/lib/lookup";

export const maxDuration = 60;

export async function GET(request: Request) {
  const ticker = cleanTicker(new URL(request.url).searchParams.get("t"));
  if (!ticker) return NextResponse.json({ error: "Enter a valid ticker." }, { status: 400 });
  try {
    return NextResponse.json(await lookup(ticker));
  } catch (error) {
    console.warn(`Lookup failed for ${ticker}:`, error);
    return NextResponse.json(
      { error: `We couldn't find ${ticker}. Check the symbol and try again.` },
      { status: 404 },
    );
  }
}
