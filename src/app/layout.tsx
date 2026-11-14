import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { Wordmark } from "@/components/logo";

export const metadata: Metadata = {
  title: "OpenPit",
  description: "Short trading rounds on dreamDEX perps. Join the creator or fade them; the best return on the cap wins at the bell.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-bg text-fg">
        <Providers>
          <header className="border-b border-line">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <Link href="/" aria-label="OpenPit home">
                <Wordmark />
              </Link>
              <Link href="/" className="text-sm text-muted hover:text-fg">
                Pits
              </Link>
              <Link href="/new" className="text-sm text-muted hover:text-fg">
                Open a pit
              </Link>
              <span className="ml-auto hidden text-xs text-muted sm:inline">Somnia Hideki testnet</span>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-1 px-4 py-4 text-xs text-muted">
              <span>Prices from dreamDEX perps on Somnia Hideki (chain 50383)</span>
              <a className="hover:text-fg" href="https://github.com/ahmardchain/openpit" target="_blank" rel="noreferrer">
                Source
              </a>
              <a className="hover:text-fg" href="https://app.testnet.dreamdex.io" target="_blank" rel="noreferrer">
                dreamDEX testnet
              </a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
