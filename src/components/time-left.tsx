"use client";
import { clock, useNow } from "./ui";

/** "12:31" until the bell, or "Settling" once it has passed. */
export function TimeLeft({ endTs }: { endTs: number }) {
  const now = useNow();
  const left = endTs - now;
  return (
    <span className="num" suppressHydrationWarning>
      {left > 0 ? clock(left) : "Settling"}
    </span>
  );
}
