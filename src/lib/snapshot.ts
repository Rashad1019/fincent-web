import "server-only";

import { ask, SNAPSHOT_ATTEMPTS, type ContentPart } from "./agents/openrouter";
import { periodReturn } from "./analytics/technicals";
import { cleanTicker } from "./config";
import { fmtPct, fmtPrice } from "./format";
import { dailyHistory, lookup } from "./lookup";
import * as fmp from "./data/fmp";

// Screenshot breakdown: read the image, check what it claims against real
// data, then explain it in plain words.

const MAX_TICKERS = 3;

export type Extracted = {
  about: string;
  tickers: string[];
  claims: { ticker: string | null; text: string }[];
  question: string | null;
};

export type ClaimCheck = {
  text: string;
  verdict: "correct" | "outdated" | "wrong" | "cant_check";
  detail: string;
};

export type Breakdown = {
  extracted: Extracted;
  overview: string;
  tickers: { ticker: string; name: string; plain: string; buyAnswer: string; facts: Record<string, string> }[];
  claims: ClaimCheck[];
  answer: string | null;
  watchOut: string | null;
};

const EXTRACT_SYSTEM =
  "You read screenshots about investing, such as social media posts, charts, and app screens. " +
  "You report exactly what the image shows. You never add facts that are not in the image.";

const EXTRACT_PROMPT = `Read this screenshot and reply with JSON only, no other text, in this shape:
{"about": "one sentence on what the post is about",
 "tickers": ["QQQM", "SCHD"],
 "claims": [{"ticker": "QQQM", "text": "Expense ratio is 0.15%"}],
 "question": "the question the post asks, or null"}
List every stock or fund ticker shown. List each factual claim as its own short sentence, with
the ticker it is about, or null if it is about more than one. If no tickers are shown, return an
empty tickers list.`;

const BREAKDOWN_SYSTEM =
  "You explain investing posts to people who have never invested. You use short, plain sentences " +
  "and everyday words. You judge claims only against the facts you are given, and you never invent " +
  "numbers.";

/** The first JSON object in a model reply, which may wrap it in text or code fences. */
export function parseJsonObject<T>(reply: string): T | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(reply.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function normalizeExtracted(raw: Partial<Extracted> | null): Extracted {
  const tickers = [
    ...new Set((raw?.tickers ?? []).map((t) => cleanTicker(String(t))).filter((t): t is string => Boolean(t))),
  ].slice(0, MAX_TICKERS);
  const claims = (raw?.claims ?? [])
    .filter((claim) => claim && typeof claim.text === "string" && claim.text.trim())
    .slice(0, 12)
    .map((claim) => ({ ticker: cleanTicker(claim.ticker ?? ""), text: claim.text.trim() }));
  return {
    about: typeof raw?.about === "string" ? raw.about : "",
    tickers,
    claims,
    question: typeof raw?.question === "string" && raw.question.trim() ? raw.question : null,
  };
}

/** Share of the first fund's weight that both funds hold, or null without holdings. */
export function overlap(a: fmp.Holding[], b: fmp.Holding[]): number | null {
  if (!a.length || !b.length) return null;
  const weights = new Map(b.map((h) => [h.symbol, h.weight]));
  return a.reduce((sum, h) => sum + Math.min(h.weight, weights.get(h.symbol) ?? 0), 0);
}

async function factsFor(ticker: string) {
  const data = await lookup(ticker);
  const year = await dailyHistory(ticker, "1y", 369).catch(() => null);
  const month = year ? year.bars.slice(-22).map((bar) => bar.close) : [];
  const facts: Record<string, string> = {
    Name: data.name,
    Type: data.profile.kind ?? (data.isFund ? "Fund" : "Stock"),
    Price: fmtPrice(data.price, data.currency),
    "Change over the past month": fmtPct(periodReturn(month)),
    "Change over the past year": fmtPct(year ? periodReturn(year.bars.map((b) => b.close)) : null),
    "Dividend yield": fmtPct(data.metrics.dividend_yield as number | null),
    "Trend right now": data.mood.label,
  };
  if (data.isFund) facts["Yearly fee (expense ratio)"] = fmtPct(data.profile.expenseRatio);
  if (data.profile.category) facts.Category = data.profile.category;
  if (!data.isFund && data.profile.sector) facts.Sector = data.profile.sector;
  return { data, facts };
}

export async function breakDown(imageDataUrl: string, deadline: number): Promise<Breakdown> {
  const imagePrompt: ContentPart[] = [
    { type: "text", text: EXTRACT_PROMPT },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ];
  const extractedReply = await ask(EXTRACT_SYSTEM, imagePrompt, { attempts: SNAPSHOT_ATTEMPTS, deadline });
  const extracted = normalizeExtracted(parseJsonObject<Partial<Extracted>>(extractedReply));

  const looked = (
    await Promise.all(extracted.tickers.map((ticker) => factsFor(ticker).catch(() => null)))
  ).filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const sharedFacts: Record<string, string> = {};
  const funds = looked.filter((entry) => entry.data.isFund);
  if (funds.length >= 2) {
    const [a, b] = funds;
    const [holdingsA, holdingsB] = await Promise.all([
      fmp.getHoldings(a.data.ticker).catch(() => []),
      fmp.getHoldings(b.data.ticker).catch(() => []),
    ]);
    const shared = overlap(holdingsA, holdingsB);
    sharedFacts[`Holdings overlap between ${a.data.ticker} and ${b.data.ticker}`] =
      shared == null ? "Not available" : fmtPct(shared);
  }

  const factBlock = looked
    .map(({ data, facts }) => [`${data.ticker}:`, ...Object.entries(facts).map(([k, v]) => `- ${k}: ${v}`)].join("\n"))
    .concat(Object.entries(sharedFacts).map(([k, v]) => `${k}: ${v}`))
    .join("\n\n");

  const breakdownPrompt = `A reader shared a screenshot. Here is what it shows:
${JSON.stringify(extracted, null, 2)}

Real data we looked up just now:
${factBlock || "No data could be found for these tickers."}

Reply with JSON only, no other text, in this shape:
{"overview": "two or three plain sentences on what the post is saying",
 "tickers": [{"ticker": "QQQM", "plain": "one or two sentences on what it is and what you own"}],
 "claims": [{"text": "the claim", "verdict": "correct", "detail": "the real figure, in one short sentence"}],
 "answer": "a plain answer to the post's question, or null if it asks none",
 "watch_out": "one sentence on the main thing a beginner should know, or null"}
For each claim, use "correct" if the real data matches, "outdated" if it is close but stale,
"wrong" if the real data clearly disagrees, and "cant_check" if the real data above doesn't cover
it. Never guess a figure that isn't listed above. No finance jargon. Don't tell the reader to buy
or sell; you can explain what kind of person each choice suits.`;

  const reply = await ask(BREAKDOWN_SYSTEM, breakdownPrompt, { attempts: SNAPSHOT_ATTEMPTS, deadline });
  const parsed = parseJsonObject<{
    overview?: string;
    tickers?: { ticker?: string; plain?: string }[];
    claims?: { text?: string; verdict?: string; detail?: string }[];
    answer?: string | null;
    watch_out?: string | null;
  }>(reply);

  const plainByTicker = new Map(
    (parsed?.tickers ?? []).map((t) => [cleanTicker(t.ticker ?? ""), t.plain ?? ""]),
  );
  const verdicts = new Set(["correct", "outdated", "wrong", "cant_check"]);

  return {
    extracted,
    overview: parsed?.overview ?? extracted.about,
    tickers: looked.map(({ data, facts }) => ({
      ticker: data.ticker,
      name: data.name,
      plain: plainByTicker.get(data.ticker) ?? "",
      buyAnswer: `${data.buy.answer}. ${data.buy.nextStep}`.trim(),
      facts,
    })),
    claims: (parsed?.claims ?? [])
      .filter((c) => c.text)
      .map((c) => ({
        text: c.text!,
        verdict: (verdicts.has(c.verdict ?? "") ? c.verdict : "cant_check") as ClaimCheck["verdict"],
        detail: c.detail ?? "",
      })),
    answer: parsed?.answer ?? null,
    watchOut: parsed?.watch_out ?? null,
  };
}
