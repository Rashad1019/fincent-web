import "server-only";

import { ask, SNAPSHOT_ATTEMPTS, type ContentPart } from "./agents/openrouter";
import { cleanTicker } from "./config";
import { fmtPrice } from "./format";
import { dailyHistory, lookup } from "./lookup";

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

/** "Up $12.40 a share", in plain words. */
function move(closes: number[], currency: string | null): string {
  if (closes.length < 2) return "Not available";
  const change = closes[closes.length - 1] - closes[0];
  return `${change >= 0 ? "Up" : "Down"} ${fmtPrice(Math.abs(change), currency)} a share`;
}

async function factsFor(ticker: string) {
  const data = await lookup(ticker);
  const year = await dailyHistory(ticker, "1y").catch(() => null);
  const closes = year?.bars.map((bar) => bar.close) ?? [];
  const facts: Record<string, string> = {
    Type: data.profile.kind ?? (data.isFund ? "Fund" : "Stock"),
    Price: fmtPrice(data.price, data.currency),
    "Past month": move(closes.slice(-22), data.currency),
    "Past year": move(closes, data.currency),
    "Trend right now": data.mood.label,
  };
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

  const factBlock = looked
    .map(({ data, facts }) => [`${data.ticker}:`, ...Object.entries(facts).map(([k, v]) => `- ${k}: ${v}`)].join("\n"))
    .join("\n\n");

  const breakdownPrompt = `A reader shared a screenshot. Here is what it shows:
${JSON.stringify(extracted, null, 2)}

Real data we looked up just now:
${factBlock || "No data could be found for these tickers."}

Reply with JSON only, no other text, in this shape:
{"overview": "two or three plain sentences on what the post is saying",
 "tickers": [{"ticker": "QQQM", "plain": "one or two sentences on what it is and what you own"}],
 "claims": [{"text": "the claim", "verdict": "correct", "detail": "what the real data shows, in one short plain sentence"}],
 "answer": "a plain answer to the post's question, or null if it asks none",
 "watch_out": "one sentence on the main thing a beginner should know, or null"}
For each claim, use "correct" if the real data matches, "outdated" if it is close but stale,
"wrong" if the real data clearly disagrees, and "cant_check" if the real data above doesn't cover
it. Never guess a figure that isn't listed above. No finance jargon, and no percentages, fees, or
ratios in anything you write: use plain words and dollar prices. Don't tell the reader to buy or
sell; you can explain what kind of person each choice suits.`;

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
