"use client";
// React-Bits-style motion primitives (CountUp, ShinyText, SpotlightCard, PulseDot, BlurFade), implemented on `motion`.
import * as React from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** Animated number that tweens to each new value. */
export function CountUp({ value, format, className, duration = 0.6 }: { value: number; format?: (n: number) => string; className?: string; duration?: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => (format ? format(v) : v.toFixed(2)));
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration, ease: "easeOut" });
    return () => c.stop();
  }, [value, mv, duration]);
  return <motion.span className={cn("tabular", className)}>{text}</motion.span>;
}

/** Accent-coloured display text (kept flat: no gradient sweep). */
export function ShinyText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-accent", className)}>{children}</span>
  );
}

/** Card that lifts its border to the accent on hover; flat, no spotlight gradient. */
export function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string; color?: string }) {
  return <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent", className)}>{children}</div>;
}

export function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-accent" />
    </span>
  );
}

/** Fades + rises children in when they scroll into view. */
export function BlurFade({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}} transition={{ duration: 0.45, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

/** Dual-colour crowd bar with a spring. */
export function CrowdBar({ longPct }: { longPct: number }) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
      <motion.div className="bg-long" animate={{ width: `${longPct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      <motion.div className="bg-fade" animate={{ width: `${100 - longPct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
    </div>
  );
}
