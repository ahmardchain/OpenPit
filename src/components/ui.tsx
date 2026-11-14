"use client";
import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";

export function Card({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line p-4 ${className}`}>{children}</div>;
}

export function ErrorBox({ error, onClose }: { error: unknown; onClose?: () => void }) {
  if (!error) return null;
  const f = friendlyError(error);
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-fade/40 bg-fade/5 p-3 text-sm">
      <div>
        <div className="font-medium text-fade">{f.title}</div>
        <div className="mt-0.5 text-fg/80">{f.detail}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-muted hover:text-fg" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function clock(secondsLeft: number) {
  const s = Math.max(0, Math.floor(secondsLeft));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function Spinner() {
  return <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-line-strong border-t-transparent align-middle" />;
}
