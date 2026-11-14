import type { Metadata } from "next";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "OpenPit — crowd pits on dreamDEX perps",
  description: "Open a 5–30 minute pit on a dreamDEX perp market. Anyone joins Long or Fade with a real on-chain order. At the bell, return-on-cap crowns the winner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Providers>
          <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
                <span className="inline-block h-6 w-6 rounded-md bg-amber-500" />
                OpenPit
                <span className="hidden rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:inline">Hideki testnet</span>
              </Link>
              <div className="flex items-center gap-2">
                <Link href="/new" className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
                  Open a pit
                </Link>
                <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-zinc-800/80 px-4 py-4 text-center text-xs text-zinc-500">
            Built for the dreamDEX Perps Builder Bounty · non-custodial · every number is read from Somnia or this app&apos;s own join log
          </footer>
        </Providers>
      </body>
    </html>
  );
}
