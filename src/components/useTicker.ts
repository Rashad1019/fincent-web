"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { cleanTicker } from "@/lib/config";
import type { Lookup } from "@/lib/lookup";

/** The ticker lives in the address (?t=IVV), so links and refreshes keep it. */
export function useTicker(): [string | null, (ticker: string) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ticker = cleanTicker(params.get("t"));
  const setTicker = (next: string) => {
    const clean = cleanTicker(next);
    router.push(clean ? `${pathname}?t=${encodeURIComponent(clean)}` : pathname);
  };
  return [ticker, setTicker];
}

type LookupState = { data: Lookup | null; error: string | null; loading: boolean };

export function useLookup(ticker: string | null): LookupState {
  const [state, setState] = useState<LookupState>({ data: null, error: null, loading: false });
  useEffect(() => {
    if (!ticker) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    fetch(`/api/lookup?t=${encodeURIComponent(ticker)}`)
      .then(async (response) => {
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) setState({ data: null, error: body.error ?? "Something went wrong.", loading: false });
        else setState({ data: body as Lookup, error: null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, error: "We couldn't reach Fincent. Try again.", loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);
  return state;
}
