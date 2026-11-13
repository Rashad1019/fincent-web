import type { Metadata } from "next";
import { Suspense } from "react";

import AnalyticsTool from "@/components/AnalyticsTool";
import { PageHeader } from "@/components/Headers";

export const metadata: Metadata = { title: "Analytics | Fincent" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        kicker="Valuation lab / risk desk"
        description="Pressure-test intrinsic value assumptions and measure recent market risk."
      />
      <Suspense>
        <AnalyticsTool />
      </Suspense>
    </>
  );
}
