"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** One character that slides when it changes. Width comes from the glyph itself, so punctuation stays tight. */
function Digit({ ch }: { ch: string }) {
  const reduce = useReducedMotion();
  const glyph = ch === " " ? "\u00a0" : ch;
  if (reduce) return <span>{glyph}</span>;
  return (
    <span className="relative inline-block overflow-hidden align-bottom leading-none" style={{ height: "1em" }}>
      <span className="invisible">{glyph}</span>
      <AnimatePresence initial={false}>
        <motion.span
          key={ch}
          className="absolute inset-0"
          initial={{ y: "100%" }}
          animate={{ y: "0%" }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {glyph}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function AnimateDigits({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline", className)}>
      {value.split("").map((ch, i) => (
        <Digit key={i} ch={ch} />
      ))}
    </span>
  );
}

function Slot({ d, large }: { d: string; large: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden border border-line-strong bg-[#0A0B0E] leading-none font-medium text-bell",
        large ? "h-11 w-9 rounded-md text-[26px] sm:h-14 sm:w-[46px] sm:text-4xl" : "h-5 min-w-[1.15em] rounded px-0.5 text-[13px]",
      )}
    >
      {reduce ? (
        d
      ) : (
        <span className="relative inline-block h-[1em] overflow-hidden">
          <span className="invisible">{d}</span>
          <AnimatePresence initial={false}>
            <motion.span
              key={d}
              className="absolute inset-0 flex items-center justify-center"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {d}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </span>
  );
}

/** Gold digit boxes for the bell. Minutes are zero-padded so the slots do not jump. */
export function BellClock({ seconds, size = "sm" }: { seconds: number; size?: "sm" | "lg" }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const left = String(mm).padStart(2, "0");
  const right = String(ss).padStart(2, "0");
  const large = size === "lg";
  const label = `${left}:${right}`;
  if (!ready) {
    return (
      <span className={cn("num font-medium text-bell", large ? "text-[28px] sm:text-4xl" : "text-[13px]")} suppressHydrationWarning aria-label={label}>
        {label}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5", large && "gap-1")} aria-label={label}>
      {left.split("").map((d, i) => (
        <Slot key={`m${i}`} d={d} large={large} />
      ))}
      <span className={cn("px-px font-medium text-bell/70", large ? "text-[28px] sm:text-[32px]" : "text-[13px]")}>:</span>
      {right.split("").map((d, i) => (
        <Slot key={`s${i}`} d={d} large={large} />
      ))}
    </span>
  );
}
