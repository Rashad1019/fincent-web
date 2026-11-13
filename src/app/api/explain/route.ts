import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { explain, fallbackText } from "@/lib/agents/explainer";
import { CACHE_SECONDS, cleanTicker } from "@/lib/config";
import type { Profile } from "@/lib/data/types";
import { lookup } from "@/lib/lookup";

export const maxDuration = 90;

// Shared by every visitor for a week. A failed call throws, so it isn't cached.
const cachedExplain = unstable_cache(
  (ticker: string, profile: Profile) => explain(ticker, profile),
  ["explain-v1"],
  { revalidate: CACHE_SECONDS.explanation },
);

export async function GET(request: Request) {
  const ticker = cleanTicker(new URL(request.url).searchParams.get("t"));
  if (!ticker) return NextResponse.json({ error: "Enter a valid ticker." }, { status: 400 });

  let profile: Profile;
  try {
    profile = (await lookup(ticker)).profile;
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    return NextResponse.json({ text: await cachedExplain(ticker, profile), writtenByAi: true });
  } catch (error) {
    console.warn(`Explanation failed for ${ticker}:`, error);
    return NextResponse.json({ text: fallbackText(ticker, profile), writtenByAi: false });
  }
}
