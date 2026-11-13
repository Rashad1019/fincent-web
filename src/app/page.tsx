import { Suspense } from "react";

import Dashboard from "@/components/Dashboard";
import { Hero } from "@/components/Headers";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense>
        <Dashboard />
      </Suspense>
    </>
  );
}
