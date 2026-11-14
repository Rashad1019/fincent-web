// The machine-readable last line of a persona reply.

const LINE = /\**VERDICT:\s*(BUY NOW|BUY|WAIT|SKIP)\s*\|\s*conviction\s*(\d{1,2})\b\**/gi;
const LABELS: Record<string, Verdict> = { "BUY NOW": "Buy now", BUY: "Buy now", WAIT: "Wait", SKIP: "Skip" };

export type Verdict = "Buy now" | "Wait" | "Skip";

/** [verdict, score] from the last verdict line. A score outside 1-10 is dropped. */
export function parseVerdict(text: string | null | undefined): [Verdict | null, number | null] {
  if (!text) return [null, null];
  const found = [...text.matchAll(LINE)];
  if (!found.length) return [null, null];
  const match = found[found.length - 1];
  const score = Number(match[2]);
  return [LABELS[match[1].toUpperCase()], score >= 1 && score <= 10 ? score : null];
}

const MOVE = /\**My move:?\**:?\s*([\s\S]*?)(?=\n\s*\**(?:Why|What could go wrong|My take)\b|\n\s*\n|$)/i;
const MOVE_MAX = 160;

/** The first sentence of the "My move" part, for a one-line preview. */
export function myMove(text: string | null | undefined): string | null {
  const found = text?.match(MOVE)?.[1]?.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
  if (!found) return null;
  // A bare "Wait." says nothing new, so keep the sentence after it too.
  const sentence = found.match(/^.{1,24}?[.!?]\s+.+?[.!?](?=\s|$)/)?.[0] ?? found.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? found;
  return sentence.length > MOVE_MAX ? `${sentence.slice(0, MOVE_MAX - 1).trimEnd()}…` : sentence;
}

/** The reply as a reader should see it, without the machine-readable line. */
export function withoutVerdict(text: string): string {
  return text.replace(LINE, "").trim();
}

/** "4 investors weighed in: 1 says buy now, 3 say wait, 0 say skip." */
export function tally(results: { reply?: string; verdict?: string | null }[]): string {
  const answered = results.filter((r) => r.reply);
  const count = (verdict: string) => answered.filter((r) => r.verdict === verdict).length;
  const say = (n: number, what: string) => `${n} ${n === 1 ? "says" : "say"} ${what}`;
  const people = answered.length === 1 ? "1 investor" : `${answered.length} investors`;
  let line = `${people} weighed in: ${say(count("Buy now"), "buy now")}, ${say(count("Wait"), "wait")}, ${say(count("Skip"), "skip")}.`;
  const missing = results.length - answered.length;
  if (missing) line += ` ${missing} couldn't answer.`;
  return line;
}
