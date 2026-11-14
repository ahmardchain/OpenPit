"use client";
import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}>{children}</div>;
}

export function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "red" | "amber" }) {
  const tones = {
    zinc: "bg-zinc-800 text-zinc-300",
    green: "bg-emerald-500/15 text-emerald-300",
    red: "bg-rose-500/15 text-rose-300",
    amber: "bg-amber-500/15 text-amber-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function ErrorBox({ error, onClose }: { error: unknown; onClose?: () => void }) {
  if (!error) return null;
  const f = friendlyError(error);
  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-rose-200">{f.title}</div>
          <div className="mt-0.5 text-rose-100/80">{f.detail}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-rose-300 hover:text-rose-100" aria-label="dismiss">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function Countdown({ endTs, onZero }: { endTs: number; onZero?: () => void }) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 500);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor(endTs - now));
  useEffect(() => {
    if (left === 0) onZero?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left === 0]);
  const m = Math.floor(left / 60);
  const s = left % 60;
  return (
    <span className="tabular font-mono text-3xl font-bold">
      {m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
    </span>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent align-middle" />;
}
