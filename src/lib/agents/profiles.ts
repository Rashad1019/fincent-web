// Generated from fintime/agents/personas.py. Safe to load in the browser: it
// holds only who each persona is, not their instructions.

export type Profile = { name: string; group: string; summary: string };

export const PROFILES: Profile[] = [
  {
    "name": "Warren Buffett",
    "group": "Classic value",
    "summary": "Wonderful businesses at fair prices — moats, high ROE, honest management, margin of safety. Treats a stock as part-ownership of a business."
  },
  {
    "name": "Benjamin Graham",
    "group": "Classic value",
    "summary": "Strict quantitative value — low P/E and P/B, conservative debt, margin of safety. Treats the market as manic Mr. Market to exploit, not follow."
  },
  {
    "name": "Joel Greenblatt",
    "group": "Classic value",
    "summary": "Systematic magic formula — high earnings yield combined with high return on capital, plus special situations like spinoffs."
  },
  {
    "name": "Peter Lynch",
    "group": "Growth and quality",
    "summary": "Growth at a reasonable price, judged by the PEG ratio. Understandable businesses, plain language, wary of diworsification."
  },
  {
    "name": "Howard Marks",
    "group": "Growth and quality",
    "summary": "Second-level thinking and market cycles — is the good news already in the price? Risk means permanent loss, not volatility."
  },
  {
    "name": "Michael Burry",
    "group": "Contrarian and macro",
    "summary": "Contrarian deep value — securities the market hates, anchored on cash flow and the balance sheet."
  },
  {
    "name": "Ray Dalio",
    "group": "Contrarian and macro",
    "summary": "Debt cycles and regimes — stress-tests a position across growth and inflation, and treats diversification as essential."
  },
  {
    "name": "Cathie Wood",
    "group": "Tech and disruptive growth",
    "summary": "Disruptive innovation — AI, robotics, genomics. Values the business five or more years out and accepts high volatility."
  },
  {
    "name": "Jack Bogle",
    "group": "Dividends and indexing",
    "summary": "Low-cost indexing. Weighs any single stock against simply owning the whole market."
  },
  {
    "name": "Geraldine Weiss",
    "group": "Dividends and indexing",
    "summary": "Dividend-yield theory. Judges blue chips by a long, growing dividend and where today's yield sits in its own history."
  },
  {
    "name": "Rick Ferri",
    "group": "ETFs",
    "summary": "A complete portfolio is a few cheap funds that do different jobs. Rejects overlap, high fees, and extra tickers that own the same market."
  },
  {
    "name": "Paul Merriman",
    "group": "ETFs",
    "summary": "Slices stocks by size, value, country, and real estate, and holds that mix for decades. A total-market fund is a start, not the whole design."
  },
  {
    "name": "Dave Nadig",
    "group": "ETFs",
    "summary": "Judges the product, not the slogan. Looks at what a fund holds, how the exposure is built, what it costs, and whether the name matches the mechanism."
  },
  {
    "name": "Daniel Sotiroff",
    "group": "ETFs",
    "summary": "Separates dividend-growth funds from covered-call funds. A higher yield often means the upside was sold, and the payout may not grow."
  },
  {
    "name": "Ian Dunlap",
    "group": "Modern voices",
    "summary": "Two elite tech companies and two broad index funds, held for five to ten years. Most investors lose by owning too many mediocre positions."
  },
  {
    "name": "Wall Street Trapper",
    "group": "Modern voices",
    "summary": "Ownership over consumption. Own the companies people spend with, and build the position one share at a time."
  }
];

export const PROFILE_BY_NAME: Record<string, Profile> = Object.fromEntries(
  PROFILES.map((profile) => [profile.name, profile]),
);

export function profilesByGroup(): [string, Profile[]][] {
  const groups: [string, Profile[]][] = [];
  for (const profile of PROFILES) {
    const last = groups[groups.length - 1];
    if (last && last[0] === profile.group) last[1].push(profile);
    else groups.push([profile.group, [profile]]);
  }
  return groups;
}
