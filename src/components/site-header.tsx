"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./logo";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const path = usePathname();
  const pits = path === "/" || path.startsWith("/pit");
  const opening = path.startsWith("/new");
  const item = "text-[13px] hover:text-fg";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-[#0B0C0F]/85 backdrop-blur-[10px]">
      <nav className="mx-auto flex h-14 max-w-[1200px] items-center gap-7 px-6 max-sm:gap-3">
        <Link href="/" aria-label="OpenPit home">
          <Wordmark />
        </Link>
        <Link href="/" className={cn(item, pits ? "text-fg" : "text-muted")} aria-current={pits ? "page" : undefined}>
          Pits
        </Link>
        <Link href="/new" className={cn(item, "hidden sm:inline", opening ? "text-fg" : "text-muted")} aria-current={opening ? "page" : undefined}>
          Open a pit
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted sm:inline-flex">
            <span className="size-1.5 rounded-full bg-long shadow-[0_0_0_3px_rgba(27,191,122,0.15)]" aria-hidden />
            Somnia Hideki testnet
          </span>
          <Button asChild>
            <Link href="/new">Open a pit</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
