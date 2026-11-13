import "server-only";

import { DataSourceError } from "./errors";
import { getHistory } from "./yahoo";

// Quote currencies that are a fraction of the reporting one: code -> [major, units per major].
const SUBUNITS: Record<string, [string, number]> = {
  GBp: ["GBP", 100],
  GBX: ["GBP", 100],
  ZAc: ["ZAR", 100],
  ILA: ["ILS", 100],
};

/**
 * Multiplier from source currency to target, or null if no rate can be found.
 * Prices can be quoted in a subunit (BP.L trades in pence), which needs its
 * own scale on top of the exchange rate.
 */
export async function rate(
  source: string | null | undefined,
  target: string | null | undefined,
): Promise<number | null> {
  if (!source || !target || source === target) return 1;
  const [major, scale] = SUBUNITS[target] ?? [target, 1];
  if (source === major) return scale;
  try {
    const { bars } = await getHistory(`${source}${major}=X`, "5d", "1d", 3600);
    return bars[bars.length - 1].close * scale;
  } catch (error) {
    if (error instanceof DataSourceError) return null;
    throw error;
  }
}
