import "server-only";

// OpenRouter chat completions. The key comes from OPENROUTER_API_KEY and is
// never sent to the browser. OPENROUTER_MODEL, when set, is the only model used.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** [model, seconds allowed for its whole reply]. */
export type Attempt = [string, number];

// One free model first, then paid models from different companies, so one
// outage can't sink a run. All three paid ones cost under $1 per million tokens written.
export const PERSONA_ATTEMPTS: Attempt[] = [
  ["google/gemma-4-31b-it:free", 30],
  ["google/gemma-4-31b-it", 90],
  ["anthropic/claude-haiku-5.5", 90],
  ["openai/gpt-6-luna", 120],
];
// The explanation holds up part of the page and has a fallback, so it gets less time.
export const EXPLANATION_ATTEMPTS: Attempt[] = [
  ["google/gemma-4-31b-it:free", 30],
  ["google/gemma-4-31b-it", 30],
];
// Two screenshot steps share one request, so each gets about half the budget.
export const SNAPSHOT_ATTEMPTS: Attempt[] = [
  ["google/gemma-4-31b-it:free", 25],
  ["google/gemma-4-31b-it", 50],
  ["anthropic/claude-haiku-5.5", 60],
];

const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);

export class OpenRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type AskOptions = {
  attempts?: Attempt[];
  /** Hard stop for the whole call, as a Date.now() timestamp. */
  deadline?: number;
};

function replyText(body: string): string | null {
  try {
    const content = JSON.parse(body)?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } catch {
    return null;
  }
}

/**
 * Send one system + user exchange and return the reply text. Tries each model
 * in order, moving on when one fails, sends nothing usable, or runs out of time.
 */
export async function ask(
  system: string,
  user: string | ContentPart[],
  { attempts = PERSONA_ATTEMPTS, deadline }: AskOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterError("OPENROUTER_API_KEY is not set.");

  const pinned = process.env.OPENROUTER_MODEL;
  const plan: Attempt[] = pinned ? [[pinned, attempts[attempts.length - 1][1]]] : attempts;

  let lastError = "no model was tried";
  for (const [model, seconds] of plan) {
    const allowedMs = Math.min(seconds * 1000, deadline ? deadline - Date.now() : Infinity);
    if (allowedMs < 3000) {
      lastError = "ran out of time";
      break;
    }
    let status: number;
    let body: string;
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        // Covers the whole reply, not just the gap between bytes.
        signal: AbortSignal.timeout(allowedMs),
        cache: "no-store",
      });
      status = response.status;
      body = await response.text();
    } catch (error) {
      lastError = `${model} did not answer: ${(error as Error).message}`;
      console.warn("Moving past model:", lastError);
      continue;
    }
    if (RETRYABLE.has(status)) {
      lastError = `${model} unavailable (HTTP ${status}): ${body.slice(0, 200)}`;
      console.warn("Moving past model:", lastError);
      continue;
    }
    if (status !== 200) throw new OpenRouterError(`OpenRouter returned HTTP ${status}: ${body.slice(0, 300)}`);
    const reply = replyText(body);
    if (reply) return reply;
    lastError = `${model} sent no reply: ${body.slice(0, 200)}`;
    console.warn("Moving past model:", lastError);
  }
  throw new OpenRouterError(`Every model failed. Last error: ${lastError}`);
}
