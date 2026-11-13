import "server-only";

import { CACHE_SECONDS } from "../config";
import { getHistory } from "./yahoo";

// Public macro numbers for the persona prompt. No key. A missing number comes
// back as null and the prompt shows N/A.
const BLS_CPI = "https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0";

export type Macro = { tenYearYield: number | null; inflationYoy: number | null };

export async function getMacro(): Promise<Macro> {
  const [tenYearYield, cpi] = await Promise.all([tenYear(), blsCpi()]);
  return { tenYearYield, inflationYoy: inflationYoy(cpi) };
}

/** Yahoo's ^TNX index, quoted in percentage points. */
async function tenYear(): Promise<number | null> {
  try {
    const { bars } = await getHistory("^TNX", "5d", "1d", CACHE_SECONDS.macro);
    return bars[bars.length - 1].close / 100;
  } catch {
    return null;
  }
}

type BlsRow = { year: string; period: string; value: string };

async function blsCpi(): Promise<Map<string, number> | null> {
  try {
    const response = await fetch(BLS_CPI, {
      headers: { "User-Agent": "fincent" },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: CACHE_SECONDS.macro },
    });
    const payload = await response.json();
    return blsSeries(payload.Results.series[0].data as BlsRow[]);
  } catch {
    return null;
  }
}

/** Month -> CPI. M13 is an annual average and "-" is a missing month. */
export function blsSeries(rows: BlsRow[]): Map<string, number> | null {
  const series = new Map<string, number>();
  for (const row of rows) {
    if (row.period === "M13" || row.value === "-") continue;
    series.set(`${row.year}-${row.period.slice(1)}`, Number(row.value));
  }
  return series.size ? series : null;
}

/**
 * Change in the latest month that has a reading a year earlier. Matching on
 * dates keeps a missing month from stretching the span.
 */
export function inflationYoy(cpi: Map<string, number> | null): number | null {
  if (!cpi) return null;
  const months = [...cpi.keys()].sort().reverse();
  for (const month of months) {
    const [year, mm] = month.split("-");
    const yearAgo = cpi.get(`${Number(year) - 1}-${mm}`);
    if (yearAgo) return cpi.get(month)! / yearAgo - 1;
  }
  return null;
}
