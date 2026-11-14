"use client";
import { BellClock } from "./digits";
import { useNow } from "./ui";

/** Digit slots until the bell, or "Settling" once it has passed. */
export function TimeLeft({ endTs, size = "sm" }: { endTs: number; size?: "sm" | "lg" }) {
  const now = useNow();
  const left = endTs - now;
  if (left <= 0) return <span className="text-[13px] text-muted">Settling</span>;
  return <BellClock seconds={left} size={size} />;
}
