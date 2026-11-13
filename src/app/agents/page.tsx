import type { Metadata } from "next";
import { Suspense } from "react";

import AgentsTool from "@/components/AgentsTool";
import { PageHeader } from "@/components/Headers";

export const metadata: Metadata = { title: "Agents | Fincent" };

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Investor agents"
        kicker="Framework studio / 16 perspectives"
        description="Run real computed ratios, DCF, risk, and technicals through distinct investor frameworks."
      />
      <Suspense>
        <AgentsTool />
      </Suspense>
    </>
  );
}
