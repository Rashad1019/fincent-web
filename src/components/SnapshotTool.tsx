"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Breakdown } from "@/lib/snapshot";

const MAX_SIDE = 1600;
const STEPS = ["Reading your screenshot...", "Checking the numbers...", "Writing your breakdown..."];
const VERDICT_ICONS: Record<string, string> = { correct: "✅", outdated: "⚠️", wrong: "❌", cant_check: "❔" };
const VERDICT_WORDS: Record<string, string> = { correct: "Correct", outdated: "Outdated", wrong: "Wrong", cant_check: "Couldn't check" };

/** Shrink a photo so it uploads fast and stays under the size limit. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read image"))), "image/jpeg", 0.85),
  );
}

export default function SnapshotTool() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (step < 0 || step >= STEPS.length - 1) return;
    const timer = setTimeout(() => setStep(step + 1), 12_000);
    return () => clearTimeout(timer);
  }, [step]);

  async function analyze() {
    if (!file) return;
    setResult(null);
    setError(null);
    setStep(0);
    try {
      const form = new FormData();
      form.append("image", await shrink(file), "screenshot.jpg");
      const response = await fetch("/api/snapshot", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) setError(body.error ?? "Something went wrong.");
      else setResult(body as Breakdown);
    } catch {
      setError("We couldn't read that image. Try another screenshot.");
    }
    setStep(-1);
  }

  const pick = (list: FileList | null) => {
    setResult(null);
    setError(null);
    setFile(list?.[0] ?? null);
  };

  return (
    <>
      <div className="drop">
        <p style={{ color: "var(--text)", marginTop: 0 }}>Upload a screenshot of a post, chart, or app screen about a stock or fund.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <label className="btn">
            Choose a screenshot
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />
          </label>
          <label className="btn">
            Take a photo
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files)} />
          </label>
        </div>
        {preview && <img src={preview} alt="Your screenshot" />}
      </div>
      <button className="btn btn-primary" disabled={!file || step >= 0} onClick={analyze}>
        Break it down
      </button>
      <p className="small">Your screenshot is sent to an AI model to be read. Fincent doesn&apos;t save it.</p>

      {step >= 0 && (
        <div className="status" aria-live="polite"><span className="spinner" />{STEPS[step]}</div>
      )}
      {error && <div className="notice error">{error}</div>}

      {result && (
        <>
          <h2>What this post is saying</h2>
          <p style={{ color: "var(--text)" }}>{result.overview}</p>

          {result.claims.length > 0 && (
            <section>
              <h2>Fact check</h2>
              <div className="card">
                {result.claims.map((claim, i) => (
                  <div key={i} className="claim">
                    <span>{VERDICT_ICONS[claim.verdict]}</span>
                    <div>
                      <div style={{ color: "var(--text)" }}>{claim.text}</div>
                      <div className="small muted">{VERDICT_WORDS[claim.verdict]}{claim.detail ? `: ${claim.detail}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.tickers.length > 0 && (
            <section>
              <h2>The investments</h2>
              <div className="cards">
                {result.tickers.map((t) => (
                  <div key={t.ticker} className="card">
                    <h3>{t.ticker} · {t.name}</h3>
                    {t.plain && <p style={{ color: "var(--text)" }}>{t.plain}</p>}
                    <p><strong style={{ color: "var(--text)" }}>Should I buy today?</strong> {t.buyAnswer}</p>
                    <table>
                      <tbody>
                        {Object.entries(t.facts).map(([k, v]) => (
                          <tr key={k}><th>{k}</th><td className="mono">{v}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <p><Link href={`/?t=${encodeURIComponent(t.ticker)}`}>See the full {t.ticker} page</Link></p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.answer && (
            <section>
              <h2>{result.extracted.question ?? "The short answer"}</h2>
              <p style={{ color: "var(--text)" }}>{result.answer}</p>
            </section>
          )}
          {result.watchOut && <div className="notice info"><strong>Good to know:</strong> {result.watchOut}</div>}
          {result.tickers.length === 0 && (
            <div className="notice info">We didn&apos;t find a stock or fund ticker in this screenshot.</div>
          )}
          <p className="small">Information only, not financial advice. Prices to watch come from past price moves.</p>
        </>
      )}
    </>
  );
}
