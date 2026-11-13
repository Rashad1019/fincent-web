import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { Suspense } from "react";

import Nav from "@/components/Nav";
import "./globals.css";

const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Fincent",
  description: "Look up any stock or fund and learn what it is, how it has done, and whether now looks like a good time.",
};

export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${mono.variable}`}>
      <body>
        <Suspense fallback={<div className="nav" style={{ height: 58 }} />}>
          <Nav />
        </Suspense>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
