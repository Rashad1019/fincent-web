import { describe, expect, it } from "vitest";

import { annual, fundamentalsFrom, latest, type CompanyFacts } from "@/lib/data/sec";

// Shaped like data.sec.gov companyfacts, trimmed to what the code reads.
const year = (start: string, end: string, val: number, form = "10-K") => ({ start, end, val, form, fp: "FY" });
const instant = (end: string, val: number, form = "10-Q") => ({ end, val, form });

const company: CompanyFacts = {
  facts: {
    dei: { EntityCommonStockSharesOutstanding: { units: { shares: [instant("2025-10-01", 1_000, "10-K"), instant("2026-04-20", 900)] } } },
    "us-gaap": {
      NetIncomeLoss: {
        units: {
          USD: [
            year("2024-01-01", "2024-12-31", 80),
            year("2025-01-01", "2025-12-31", 100),
            // A quarter must be ignored.
            { start: "2025-10-01", end: "2025-12-31", val: 30, form: "10-K", fp: "FY" },
          ],
        },
      },
      // Old revenue name, stopped in 2020; the newer one should win.
      SalesRevenueNet: { units: { USD: [year("2019-01-01", "2019-12-31", 500)] } },
      RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [year("2025-01-01", "2025-12-31", 1_000)] } },
      NetCashProvidedByUsedInOperatingActivities: { units: { USD: [year("2025-01-01", "2025-12-31", 150)] } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [year("2025-01-01", "2025-12-31", 30)] } },
      PaymentsOfDividends: { units: { USD: [year("2025-01-01", "2025-12-31", 25)] } },
      EarningsPerShareDiluted: {
        units: { "USD/shares": [year("2024-01-01", "2024-12-31", 0.8), year("2025-01-01", "2025-12-31", 1.0)] },
      },
      StockholdersEquity: { units: { USD: [instant("2025-12-31", 400, "10-K"), instant("2026-03-31", 450)] } },
      LongTermDebtNoncurrent: { units: { USD: [instant("2026-03-31", 200)] } },
      LongTermDebtCurrent: { units: { USD: [instant("2026-03-31", 20)] } },
      CommercialPaper: { units: { USD: [instant("2026-03-31", 5)] } },
    },
  },
};

describe("SEC company figures", () => {
  it("keeps full years only, newest first", () => {
    expect(annual(company, ["NetIncomeLoss"]).map((f) => f.val)).toEqual([100, 80]);
  });

  it("uses whichever revenue name was filed most recently", () => {
    expect(annual(company, ["RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"])[0].val).toBe(1_000);
  });

  it("takes the newest balance-sheet value", () => {
    expect(latest(company, ["StockholdersEquity"])?.val).toBe(450);
  });

  it("builds the figures the investors use", () => {
    const f = fundamentalsFrom(company, 50)!;
    expect(f.netIncome).toBe(100);
    expect(f.revenue).toBe(1_000);
    expect(f.freeCashFlow).toBe(120);
    expect(f.sharesOutstanding).toBe(900);
    expect(f.marketCap).toBe(45_000);
    expect(f.shareholderEquity).toBe(450);
    expect(f.bookValuePerShare).toBe(0.5);
    expect(f.totalDebt).toBe(225);
    expect(f.eps).toBe(1.0);
    expect(f.earningsGrowth).toBeCloseTo(0.25, 10);
    expect(f.payoutRatio).toBe(0.25);
  });

  it("returns nothing without an annual profit figure", () => {
    expect(fundamentalsFrom({ facts: {} }, 50)).toBeNull();
  });
});
