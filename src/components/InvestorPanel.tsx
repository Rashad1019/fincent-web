"use client";

import { useEffect, useRef, useState } from "react";

import { PROFILE_BY_NAME, profilesByGroup } from "@/lib/agents/profiles";
import { myMove, tally } from "@/lib/agents/verdicts";
import Markdown from "./Markdown";

type Result = {
  persona: string;
  reply?: string;
  verdict?: string | null;
  conviction?: number | null;
  error?: string;
};
type Status = "pending" | "done" | "busy";

// The free try and two paid tries take up to 3.5 minutes; after that an
// investor is on the last model, so a joke helps the wait.
const JOKE_AFTER_MS = 210_000;
const JOKES = [
  "Why did the investor bring a ladder to work? They heard the market was reaching new highs.",
  "What's the difference between a bond and a bond trader? A bond eventually matures.",
  "Why don't bears get invited to parties? They always expect things to go down.",
  "I asked my broker for a stock that would let me sleep at night. They sold me a mattress company.",
  "My long-term investing plan is simple: buy low, then check my account a lot less often.",
];
// What each verdict looks like on the page.
const VERDICT_LOOK: Record<string, { icon: string; words: string }> = {
  "Buy now": { icon: "🟢", words: "Buy now" },
  Wait: { icon: "🟡", words: "Wait for a better price" },
  Skip: { icon: "🔴", words: "Skip it" },
};

const NETWORK_BUSY = "The network is busy right now. Please try again in a few minutes.";

export function ProfilesList({ open = false }: { open?: boolean }) {
  return (
    <details open={open}>
      <summary>Who these personas are</summary>
      <div>
        {profilesByGroup().map(([group, profiles]) => (
          <div key={group}>
            <p style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>{group}</p>
            {profiles.map((profile) => (
              <p key={profile.name} style={{ marginTop: 0 }}>
                <strong style={{ color: "var(--text)" }}>{profile.name}</strong> — {profile.summary}
              </p>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

function Picker({ selected, onChange }: { selected: string[]; onChange: (names: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  return (
    <div className="picker" ref={box}>
      <label className="muted small">Choose your investors</label>
      <div
        className="picker-box"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setOpen(!open)}
      >
        {selected.length === 0 && <span className="muted">Choose one or more</span>}
        {selected.map((name) => (
          <span key={name} className="chip">
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                toggle(name);
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {open && (
        <div className="picker-menu">
          {profilesByGroup().map(([group, profiles]) => (
            <div key={group}>
              <div className="picker-group">{group}</div>
              {profiles.map(({ name }) => (
                <label key={name} className="picker-option">
                  <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
                  {name}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pick investors and ask them about one ticker. Mount with key={ticker} so a
 * new ticker always starts with nothing picked and no answers.
 */
export default function InvestorPanel({ ticker }: { ticker: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [results, setResults] = useState<Result[] | null>(null);
  const [running, setRunning] = useState(false);
  const [joke, setJoke] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function run() {
    const names = [...selected];
    setRunning(true);
    setFailed(false);
    setJoke(null);
    setStatuses(Object.fromEntries(names.map((name) => [name, "pending"])));
    setToast(`Asking ${names.length} about ${ticker}...`);
    const jokeTimer = setTimeout(() => setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]), JOKE_AFTER_MS);

    const replies = await Promise.all(
      names.map(async (persona): Promise<Result> => {
        let result: Result;
        try {
          const response = await fetch("/api/persona", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker, persona }),
          });
          result = await response.json();
          if (!response.ok) result = { persona, error: result.error ?? "busy" };
        } catch {
          result = { persona, error: "busy" };
        }
        setStatuses((previous) => ({ ...previous, [persona]: result.reply ? "done" : "busy" }));
        return result;
      }),
    );

    clearTimeout(jokeTimer);
    setJoke(null);
    setRunning(false);
    const answered = replies.filter((r) => r.reply).length;
    if (answered) {
      setResults(replies);
      setToast(`${answered} of ${names.length} answered`);
    } else {
      setFailed(true);
    }
  }

  const done = Object.values(statuses).filter((s) => s !== "pending").length;

  return (
    <section>
      <h2>What the investors would say</h2>
      <p className="small">
        Inspired by how famous investors think. These aren&apos;t the real people, and this isn&apos;t financial advice.
      </p>
      <ProfilesList />
      <Picker selected={selected} onChange={setSelected} />
      <button className="btn btn-primary" disabled={!selected.length || running} onClick={run}>
        Ask them about {ticker}
      </button>

      {toast && <div className="toast" role="status">{toast}</div>}

      {running && (
        <div className="status" aria-live="polite">
          <div>
            <span className="spinner" />
            {done ? `${done} of ${Object.keys(statuses).length} answered...` : `Asking about ${ticker}. This can take a few minutes...`}
          </div>
          <ul>
            {Object.entries(statuses).map(([name, status]) => (
              <li key={name}>
                {status === "pending" && `⏳ ${name} is reading the numbers...`}
                {status === "done" && `✅ ${name} has answered`}
                {status === "busy" && `⚠️ ${name}: the network is busy`}
              </li>
            ))}
          </ul>
          {joke && <div className="notice info">This is taking a while, so here&apos;s a joke:<br /><br />{joke}</div>}
        </div>
      )}

      {failed && <div className="notice error">{NETWORK_BUSY}</div>}

      {results && !running && (
        <>
          <div className="tally">{tally(results)}</div>
          {results.map((r) => {
            const profile = PROFILE_BY_NAME[r.persona];
            const look = r.verdict ? VERDICT_LOOK[r.verdict] : null;
            const move = myMove(r.reply);
            return (
              <details key={r.persona} className="investor">
                <summary>
                  <span className="verdict-line">
                    {r.reply
                      ? look
                        ? `${look.icon} ${r.persona} says: ${look.words}`
                        : `⚪ ${r.persona} didn't give a clear answer`
                      : `⚠️ ${r.persona} couldn't answer (the network was busy)`}
                  </span>
                  {move && <span className="move-line">&ldquo;{move}&rdquo;</span>}
                </summary>
                <div>
                  {profile && <p className="small">{profile.group} · {profile.summary}</p>}
                  {r.reply ? <Markdown text={r.reply} /> : <div className="notice error">The network was busy, so this investor could not answer.</div>}
                </div>
              </details>
            );
          })}
          <p className="small">Click an investor to read their full reasons.</p>
        </>
      )}
    </section>
  );
}
