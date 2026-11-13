"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/snapshot", label: "Snapshot" },
  { href: "/agents", label: "Agents" },
];

/** The menu, always on screen. It carries the current ticker between pages. */
export default function Nav() {
  const pathname = usePathname();
  const ticker = useSearchParams().get("t");
  const query = ticker ? `?t=${encodeURIComponent(ticker)}` : "";
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link className="wordmark" href={`/${query}`}>
          <span className="wordmark-symbol" /> fincent
        </Link>
        <div className="nav-links">
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={`${href}${query}`} aria-current={pathname === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
