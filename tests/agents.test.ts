import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ask, EXPLANATION_ATTEMPTS, PERSONA_ATTEMPTS } from "@/lib/agents/openrouter";
import { buildPrompt } from "@/lib/agents/prompt";
import { PERSONAS } from "@/lib/agents/personas";
import { PROFILES } from "@/lib/agents/profiles";
import { parseVerdict, withoutVerdict } from "@/lib/agents/verdicts";
import { toHtml } from "@/components/Markdown";
import { inflationYoy, blsSeries } from "@/lib/data/macro";
import { normalizeExtracted, parseJsonObject } from "@/lib/snapshot";

describe("personas", () => {
  it("all 16 have a prompt and a profile", () => {
    expect(Object.keys(PERSONAS)).toHaveLength(16);
    expect(new Set(PROFILES.map((p) => p.name))).toEqual(new Set(Object.keys(PERSONAS)));
  });
  it("the prompt asks for the short plain format", () => {
    const prompt = buildPrompt("IVV", { price: 759.18, dividend_yield: 0.0111, better_price: null });
    expect(prompt).toContain("- Current price: 759.18");
    expect(prompt).toContain("- Dividend yield: 1.11%");
    expect(prompt).toContain("- Better price to wait for: N/A");
    expect(prompt).toContain("**My move:**");
    expect(prompt).toContain("under 100 words");
    expect(prompt).toContain("VERDICT: WAIT | conviction 7");
  });
});

describe("verdicts", () => {
  it("reads the last verdict line", () => {
    expect(parseVerdict("VERDICT: WAIT | conviction 4\nVERDICT: SKIP | conviction 8")).toEqual(["Skip", 8]);
    expect(parseVerdict("VERDICT: buy | conviction 7")).toEqual(["Buy now", 7]);
    expect(parseVerdict("VERDICT: WAIT | conviction 12")).toEqual(["Wait", null]);
    expect(parseVerdict("nothing")).toEqual([null, null]);
  });
  it("hides the line from readers", () => {
    expect(withoutVerdict("**My take:** Fine.\n\n**VERDICT: WAIT | conviction 6**")).toBe("**My take:** Fine.");
  });
});

describe("model order", () => {
  it("is one free model, then three paid ones with the agreed time limits", () => {
    expect(PERSONA_ATTEMPTS.map(([, s]) => s)).toEqual([30, 90, 90, 120]);
    expect(PERSONA_ATTEMPTS[0][0].endsWith(":free")).toBe(true);
    expect(PERSONA_ATTEMPTS.slice(1).some(([m]) => m.endsWith(":free"))).toBe(false);
    expect(EXPLANATION_ATTEMPTS.reduce((sum, [, s]) => sum + s, 0)).toBeLessThanOrEqual(60);
  });
});

describe("ask", () => {
  const reply = (content: string | null) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  let calls: string[];
  beforeEach(() => {
    calls = [];
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    vi.stubEnv("OPENROUTER_MODEL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const queue = (responses: (Response | Error)[]) =>
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)).model);
      const next = responses.shift()!;
      if (next instanceof Error) throw next;
      return next;
    }));

  it("moves past busy, broken, slow, and empty models", async () => {
    queue([new Response("busy", { status: 429 }), new Response("down", { status: 503 }), new Error("timeout"), reply("Answer")]);
    await expect(ask("s", "u")).resolves.toBe("Answer");
    expect(calls).toEqual(PERSONA_ATTEMPTS.map(([m]) => m));
  });
  it("treats an empty reply as a failure", async () => {
    queue([reply("  "), reply("Answer")]);
    await expect(ask("s", "u")).resolves.toBe("Answer");
  });
  it("stops at a key or credit problem", async () => {
    queue([new Response("no credits", { status: 402 })]);
    await expect(ask("s", "u")).rejects.toThrow("HTTP 402");
    expect(calls).toHaveLength(1);
  });
  it("gives up when every model fails", async () => {
    queue(PERSONA_ATTEMPTS.map(() => new Response("busy", { status: 429 })));
    await expect(ask("s", "u")).rejects.toThrow("Every model failed");
  });
  it("starts no new try once the deadline is close", async () => {
    queue([reply("Answer")]);
    await expect(ask("s", "u", { deadline: Date.now() + 1000 })).rejects.toThrow("ran out of time");
    expect(calls).toHaveLength(0);
  });
  it("uses only the pinned model when one is set", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "some/model");
    queue([reply("Answer")]);
    await ask("s", "u");
    expect(calls).toEqual(["some/model"]);
  });
});

describe("snapshot helpers", () => {
  it("finds JSON inside a chatty reply", () => {
    expect(parseJsonObject<{ a: number }>('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject("no json")).toBeNull();
  });
  it("cleans tickers and claims", () => {
    const result = normalizeExtracted({
      about: "QQQM vs SCHD",
      tickers: ["qqqm", "SCHD", "SCHD", "not a ticker!", "VOO", "VTI"],
      claims: [{ ticker: "qqqm", text: " Fee is 0.15% " }, { ticker: null, text: "" }],
      question: "Would you own both?",
    });
    expect(result.tickers).toEqual(["QQQM", "SCHD", "VOO"]);
    expect(result.claims).toEqual([{ ticker: "QQQM", text: "Fee is 0.15%" }]);
  });
});

describe("page safety and macro", () => {
  it("markdown escapes HTML before adding bold", () => {
    expect(toHtml("**Hi** <script>x</script>")).toBe("<p><strong>Hi</strong> &lt;script&gt;x&lt;/script&gt;</p>");
  });
  it("inflation compares with the same month a year earlier", () => {
    const cpi = blsSeries([
      { year: "2026", period: "M01", value: "103" },
      { year: "2025", period: "M13", value: "101" },
      { year: "2025", period: "M02", value: "-" },
      { year: "2025", period: "M01", value: "100" },
    ]);
    expect(inflationYoy(cpi)).toBeCloseTo(0.03, 10);
    expect(inflationYoy(null)).toBeNull();
  });
});
