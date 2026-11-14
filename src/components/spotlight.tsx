"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/** One pointer-following wash. Parked at the top-right until the pointer enters. */
export function Spotlight({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(e: React.MouseEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !ref.current) return;
    ref.current.style.setProperty("--sx", `${e.clientX - box.left}px`);
    ref.current.style.setProperty("--sy", `${e.clientY - box.top}px`);
  }
  return (
    <div ref={ref} onMouseMove={move} className={cn("relative isolate overflow-hidden rounded-lg border border-line bg-surface", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(420px 220px at var(--sx, 88%) var(--sy, 0%), rgba(59,108,255,0.16), transparent 60%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
