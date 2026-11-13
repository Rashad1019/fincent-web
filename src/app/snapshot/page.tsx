import type { Metadata } from "next";

import { PageHeader } from "@/components/Headers";
import SnapshotTool from "@/components/SnapshotTool";

export const metadata: Metadata = { title: "Snapshot | Fincent" };

export default function SnapshotPage() {
  return (
    <>
      <PageHeader
        title="Snapshot"
        kicker="Screenshot check / plain breakdown"
        description="Saw a post about a stock or fund? Upload a screenshot. Fincent reads it, checks the claims against real data, and explains it in plain words."
      />
      <SnapshotTool />
    </>
  );
}
