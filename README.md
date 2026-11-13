# Fincent (web)

Fincent rebuilt in JavaScript (Next.js) to run on Vercel, so it never goes to sleep and anyone can open it. It is for ordinary people who just heard about a stock or fund. They want to know what it is, its price, how it has done, and whether to buy it today. No percentages, fees, or ratios on the page.

## What it does

| Page | What a visitor gets |
|---|---|
| **Dashboard** (`/`) | Enter a ticker. See what it is and why people buy it, the price, how it has moved in dollars ("Up $12.40 a share over the past month", "$1,000 put in a month ago would be about $1,016 today"), "Should I buy today?" with prices to watch, and the investors |
| **Snapshot** (`/snapshot`) | Upload a screenshot of a post, chart, or app screen. Fincent reads it, checks each claim against real data (✅ ⚠️ ❌ ❔), and explains it in plain words |
| **Analytics** (`/analytics`) | DCF calculator and risk numbers. This is the one page that shows the math |
| **Agents** (`/agents`) | Ask the 16 investor personas about a ticker |

The menu is always visible. The ticker is kept in the address (`?t=SPY`), so it carries between pages. No ticker is filled in by default.

## Where the data comes from

All free, no accounts to sign up for:

- **Yahoo:** price, charts, name, and dividend history.
- **SEC:** a US company's profit, debt, and cash flow, from its filed reports. The investors use these to think. Visitors never see them. Funds and foreign stocks don't have them, so the investors go by the price history.
- **OpenRouter:** the only paid service. It writes "What it is", the investors' answers, and screenshot breakdowns.

## Carried over from the Streamlit version

- **Look:** "Read the market. Know the business.", the blue Black Ledger design, the same fonts and hero image.
- **The 16 investors:** generated from `fintime/agents/personas.py`, word for word. They are now also told never to write percentages, ratios, or fees.
- **Investor answers:** under 100 words with My take, My move, Why, and What could go wrong. Verdicts are Buy now, Wait, or Skip.
- **Model order:** free Gemma for 30 seconds, paid Gemma for 90, Claude Haiku 5.5 for 90, and GPT-6 Luna for 120.
- **Waiting:** the joke, the per-investor loading lines, and "The network is busy" message.
- **Calculations:** trend, entry read, price levels, buy answer, and risk, checked against the Python code.
- **Fresh start:** every ticker starts with no investors picked and no answers.

## Removed on purpose

- Key numbers (fees, dividend yield, P/E, profit margin, swings), "How we got this", and "Numbers given to the personas".
- Fund fee and holdings overlap in Snapshot.
- FMP, which needed its own key.
- The data-provider picker and the two replacement ideas from the Streamlit version.

## Settings in Vercel

| Name | Needed? | What it is |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter key |
| `SEC_CONTACT_EMAIL` | Optional | Any email you check. The SEC asks every caller for a contact email. It's free and needs no sign-up. Without it, the investors judge stocks by price history only |
| `OPENROUTER_MODEL` | No | Forces one model for every AI call |

## Checks already run

- `npm test`: 50 tests pass, including parity checks against the Python calculations and the SEC figure reader.
- `npm run build` completes, and every page is static, so the first load is fast.
- SPY loads from Yahoo with its price, a month of chart, and the buy answer.

## Not verified yet

- **Nothing has run on Vercel**, and **no real AI reply** has been tested.
- **SEC data hasn't been fetched live.** The SEC refuses requests without a contact email, and none was set here. The reader is tested against data shaped like the SEC's.
- **Yahoo from Vercel:** Yahoo has blocked some hosted servers. If it does, prices and charts fail, and there is no backup.

## Decisions to review

1. **Vercel's time limit is 300 seconds a request.** The four investor tries add up to 330 seconds, so the last try is cut short at 290.
2. **The joke** appears 3.5 minutes after asking. The page can't see which model is running, so the timing is approximate.
3. **The screenshot check uses AI** to compare claims with the looked-up prices. Claims about fees or yields come back as "Couldn't check".
4. **No usage limits.** Anyone can run investors and screenshots on the OpenRouter key.

## To put it online

1. Import `Rashad1019/fincent-web` in Vercel.
2. Add `OPENROUTER_API_KEY`, and optionally `SEC_CONTACT_EMAIL`, in the project's settings. Never put them in the code.
3. Open the Vercel address and try SPY, a stock such as AAPL, and one screenshot.
4. Optionally, point `fincent.micorpus.tech` at it in Vercel's domain settings.
