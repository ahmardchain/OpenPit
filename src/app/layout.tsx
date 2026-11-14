import type { Metadata } from "next";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import "./globals.css";
import { Providers } from "./providers";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";

export const metadata: Metadata = {
  title: "OpenPit — crowd pits on dreamDEX perps",
  description: "Open a 5–30 minute pit on a dreamDEX perp market. Anyone joins Long or Fade with a real on-chain order. At the bell, return-on-cap crowns the winner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="relative min-h-full flex flex-col overflow-x-hidden bg-bg text-fg">
        <Providers>
          <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <Wordmark />
                <span className="hidden rounded-md border border-line px-1.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider text-muted sm:inline">Hideki testnet</span>
              </Link>
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <Link href="/new">Open a pit</Link>
                </Button>
                <WalletButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
              </div>
            </div>
          </header>
          <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
          <footer className="relative border-t border-line px-4 py-4 text-center text-xs text-muted">
            Built for the dreamDEX Perps Builder Bounty · non-custodial · every number is read from Somnia or this app&apos;s own join log
          </footer>
        </Providers>
      </body>
    </html>
  );
}
