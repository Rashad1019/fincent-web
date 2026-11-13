# Fincent (web)

Fincent rebuilt in JavaScript (Next.js) to run on Vercel, so it never goes to sleep and anyone can open it. It is for ordinary people who just heard about a stock or fund.

**Status:** code review. This folder is not connected to GitHub or Vercel yet.

## What it does

| Page | What a visitor gets |
|---|---|
| **Dashboard** (`/`) | Enter a ticker. See what it is in plain words, how it has done (past month by default), "Should I buy today?" with prices to watch, key numbers, and the investors |
| **Snapshot** (`/snapshot`) | **New.** Upload a screenshot of a post, chart, or app screen. Fincent reads it, checks each claim against real data (✅ ⚠️ ❌ ❔), and explains it in plain words |
| **Analytics** (`/analytics`) | DCF calculator and risk numbers |
| **Agents** (`/agents`) | Ask the 16 investor personas about a ticker |

The menu is always visible. The ticker is kept in the address (`?t=IVV`), so it carries between pages and survives a refresh. No ticker is filled in by default.

## Carried over from the Streamlit version

- **Look:** "Read the market. Know the business.", the blue Black Ledger design, the same fonts and hero image.
- **The 16 investors:** generated directly from `fintime/agents/personas.py`, word for word.
- **Investor answers:** under 100 words with My take, My move, Why, and What could go wrong. Verdicts are Buy now, Wait, or Skip.
- **Model order:** free Gemma for 30 seconds, paid Gemma for 90, Claude Haiku 5.5 for 90, and GPT-6 Luna for 120.
- **Waiting:** the joke, the per-investor loading lines, and "The network is busy" message.
- **Calculations:** trend, entry read, price levels, buy answer, risk, and dividend yields.
- **Earlier fixes:** payout-based fund yields, currency conversion for foreign stocks, and fund sectors left out of fund titles.
- **Fresh start:** every ticker starts with no investors picked and no answers. Answers belong to the visitor and are never shared.

## Layout

```
src/
  app/                 pages, plus api/ routes that run on the server
    api/lookup         everything about one ticker
    api/history        chart bars for a timeframe
    api/explain        the "What it is" text, cached for a week
    api/persona        one investor's answer (one request per investor)
    api/snapshot       screenshot breakdown
  components/          page pieces (Dashboard, InvestorPanel, SnapshotTool, ...)
  lib/
    analytics/         technicals, risk, dividends, valuation (pure math)
    agents/            OpenRouter, personas, prompt, verdicts, explainer
    data/              Yahoo chart feed, FMP, currency, macro
    lookup.ts          gathers one ticker's data, cached for 5 minutes
    snapshot.ts        read screenshot, check claims, write breakdown
tests/                 46 tests, including Python parity checks
```

## Checks already run

- `npm test` runs 46 tests, and all pass. The parity tests run the original Python calculations and the new JavaScript ones on the same data, and require them to match to 9 decimal places.
- `npm run build` completes, and every page is static, so the first load is fast.
- No persona instructions or API key names appear in the code sent to browsers.
- Yahoo's real chart data has the fields the code reads (checked with IVV).

## Not verified yet

- **Nothing has run on Vercel**, and **no real AI reply** has been tested. This machine has no keys.
- **FMP fund fee and holdings:** `etf/info` and `etf/holdings` are coded from FMP's documentation and haven't been called. The fee is assumed to be in percentage points. Check that IVV shows 0.03%. Holdings may need a paid FMP plan; without them, the overlap check shows "Not available".
- **Yahoo from Vercel:** Yahoo has blocked some hosted servers. If it does, daily charts fall back to FMP, but intraday charts (1 day and 1 week) have no backup.
- **The first-try model, `google/gemma-4-31b-it:free`, will see the screenshot.** All four models list image support on OpenRouter.

## Decisions to review

1. **Vercel's time limit is 300 seconds a request, on every plan.** The four investor tries add up to 330 seconds, so the last try is cut short once 290 seconds have passed. Raising the limit needs a paid Vercel plan, if it's allowed at all.
2. **The joke** appears 3.5 minutes after asking, which is roughly when an investor reaches the last model. The page can't see which model is running, so the timing is approximate.
3. **Explanations** use one free try and one paid try, 30 seconds each, so the page doesn't wait long.
4. **The screenshot check uses AI to compare claims with the looked-up numbers.** It's told not to guess, but it can still be wrong. Simple claims, such as fees, could be checked by code instead.
5. **Removed from the Streamlit version:** the data-provider picker and the two replacement ideas shown after investor answers.
6. **No usage limits.** Anyone can run investors and screenshots on the OpenRouter key. A daily limit per visitor would be the next safeguard.

## To put it online (next step, not done)

1. Create a new GitHub repository, for example `Rashad1019/fincent-web`, and push this folder.
2. Import the repository in Vercel.
3. Add `OPENROUTER_API_KEY` and `FMP_API_KEY` in Vercel's project settings. Never put them in the code.
4. Open the Vercel address and check IVV, a stock such as AAPL, and one screenshot.
5. Optionally, point `fincent.micorpus.tech` at it in Vercel's domain settings.
