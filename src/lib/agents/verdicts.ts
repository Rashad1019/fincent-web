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

/** The reply as a reader should see it, without the machine-readable line. */
export function withoutVerdict(text: string): string {
  return text.replace(LINE, "").trim();
}
