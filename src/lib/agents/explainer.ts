import "server-only";

import type { Profile } from "../data/types";
import { ask, EXPLANATION_ATTEMPTS } from "./openrouter";

// A plain description of a ticker for someone new to investing.
const SYSTEM =
  "You explain investments to people who have never invested. Use short, plain sentences and no " +
  "jargon. If a term is unavoidable, say what it means. You describe what something is. You never " +
  "say whether to buy it.";

export function buildExplainPrompt(ticker: string, profile: Profile): string {
  const facts = [`Ticker: ${ticker}`, `Name: ${profile.name || ticker}`];
  const fields: [string, string | null][] = [
    ["Type", profile.kind],
    ["Fund family", profile.family],
    ["Category", profile.category],
    ["Sector", profile.isFund ? null : profile.sector],
    ["Industry", profile.isFund ? null : profile.industry],
    ["Description", profile.summary],
  ];
  for (const [label, value] of fields) if (value) facts.push(`${label}: ${value}`);
  return [
    ...facts,
    "",
    "In three or four short sentences, explain what this is, what you actually own if you buy it, " +
      "and who it is usually for.",
    "Use only the facts above and what the name itself tells you. Do not include prices, returns, " +
      "or dates. If the facts are thin, write less rather than guessing.",
  ].join("\n");
}

/** Throws OpenRouterError when no model answers. */
export async function explain(ticker: string, profile: Profile): Promise<string> {
  const reply = await ask(SYSTEM, buildExplainPrompt(ticker, profile), { attempts: EXPLANATION_ATTEMPTS });
  return reply.trim();
}

/** What to show when no model is available. */
export function fallbackText(ticker: string, profile: Profile): string {
  if (profile.summary) return profile.summary;
  let kind = profile.kind ?? "investment";
  if (kind !== "ETF") kind = kind.toLowerCase();
  const article = /^[aeiou]/i.test(kind) ? "an" : "a";
  return `${profile.name || ticker} (${ticker}) is ${article} ${kind}.`;
}
