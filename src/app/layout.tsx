import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenPit",
  description: "Short trading rounds on dreamDEX perps. Join the creator or fade them; the best return on the cap wins at the bell.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-bg text-fg">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-7">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-6 gap-y-2 px-6 py-4 text-xs text-muted">
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
