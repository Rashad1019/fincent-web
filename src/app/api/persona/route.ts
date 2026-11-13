import { NextResponse } from "next/server";

import { ask, OpenRouterError } from "@/lib/agents/openrouter";
import { PERSONAS } from "@/lib/agents/personas";
import { buildPrompt } from "@/lib/agents/prompt";
import { parseVerdict, withoutVerdict } from "@/lib/agents/verdicts";
import { cleanTicker } from "@/lib/config";
import { lookup } from "@/lib/lookup";

// One investor per request, so a slow one never holds up the others.
// Vercel's limit for one request depends on the plan; 300 seconds is the
// most every plan allows, so the model order is cut short at that point.
export const maxDuration = 300;
const BUDGET_MS = 290_000;

export async function POST(request: Request) {
  const started = Date.now();
  const body = (await request.json().catch(() => null)) as { ticker?: string; persona?: string } | null;
  const ticker = cleanTicker(body?.ticker);
  const persona = body?.persona ?? "";
  if (!ticker || !PERSONAS[persona]) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  let prompt: string;
  try {
    // The numbers are rebuilt here, never taken from the browser.
    prompt = buildPrompt(ticker, (await lookup(ticker)).metrics);
  } catch {
    return NextResponse.json({ error: "We couldn't load this ticker's numbers." }, { status: 404 });
  }

  try {
    const reply = await ask(PERSONAS[persona], prompt, { deadline: started + BUDGET_MS });
    const [verdict, conviction] = parseVerdict(reply);
    return NextResponse.json({ persona, reply: withoutVerdict(reply), verdict, conviction, prompt });
  } catch (error) {
    if (!(error instanceof OpenRouterError)) throw error;
    console.warn(`Persona ${persona} failed for ${ticker}:`, error.message);
    return NextResponse.json({ persona, error: "busy" }, { status: 503 });
  }
}
