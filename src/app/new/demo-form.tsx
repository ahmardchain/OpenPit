"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MarketRow } from "@/lib/markets-server";
import { usePlayerName, validName } from "@/lib/player";
import { fmtUsd } from "@/lib/scoring";
import { ErrorBox } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const seg = (on: boolean) =>
  cn("h-9 rounded-md border px-3 text-sm transition-colors", on ? "border-accent bg-accent text-accent-ink" : "border-line-strong hover:bg-surface");

/** Paper pit: no wallet. The server opens the creator's position at the live dreamDEX mark. */
export function DemoForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = usePlayerName();
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [symbol, setSymbol] = useState(sp.get("market") ?? "BTC");
  const [side, setSide] = useState<"long" | "short">(sp.get("side") === "short" ? "short" : "long");
  const [duration, setDuration] = useState([5, 15, 30].includes(Number(sp.get("duration"))) ? Number(sp.get("duration")) : 5);
  const [cap, setCap] = useState(Number(sp.get("cap") ?? 100) || 100);
  const [thesis, setThesis] = useState(sp.get("thesis") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json() as Promise<{ markets?: MarketRow[]; error?: string }>)
      .then((j) => (j.markets ? setMarkets(j.markets) : setError(j.error ?? "Could not load markets.")))
      .catch(() => setError("Could not load markets from dreamDEX."));
  }, []);
  const market = useMemo(() => markets?.find((m) => m.symbol === symbol), [markets, symbol]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validName(name)) return setError("Pick a name of 2 to 20 letters, digits, dots, dashes or underscores.");
    setBusy(true);
    try {
      const r = await fetch("/api/pits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "demo", name: name.trim(), market: symbol, side, durationMin: duration, capUsd: cap, thesis, parentId: sp.get("rematch") ?? undefined }),
      });
      const j = (await r.json()) as { id?: string; error?: string };
      if (!r.ok || !j.id) throw new Error(j.error ?? "Could not open the pit.");
      router.push(`/pit/${j.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-1">
        <label htmlFor="name" className="label block">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="e.g. satoshi_fade"
          className="h-10 w-full max-w-xs rounded-md border border-line-strong px-3 outline-none focus:border-accent"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Market</legend>
        {!markets ? (
          <p className="text-sm text-muted">Loading markets from dreamDEX</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {markets.map((m) => (
              <button type="button" key={m.symbol} onClick={() => setSymbol(m.symbol)} className={seg(symbol === m.symbol)}>
                {m.symbol}
              </button>
            ))}
          </div>
        )}
        {market?.markPrice && (
          <p className="text-sm text-muted">
            {market.symbol}-PERP mark <span className="num text-fg">{fmtUsd(BigInt(market.markPrice))}</span>
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label">Your call</legend>
        <div className="grid max-w-sm grid-cols-2 gap-2">
          <button type="button" onClick={() => setSide("long")} className={cn("h-11 rounded-md border font-medium", side === "long" ? "border-long bg-long text-white" : "border-line-strong hover:bg-surface")}>
            Long
          </button>
          <button type="button" onClick={() => setSide("short")} className={cn("h-11 rounded-md border font-medium", side === "short" ? "border-fade bg-fade text-white" : "border-line-strong hover:bg-surface")}>
            Short
          </button>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-8">
        <fieldset className="space-y-2">
          <legend className="label">Length</legend>
          <div className="flex gap-2">
            {[5, 15, 30].map((d) => (
              <button type="button" key={d} onClick={() => setDuration(d)} className={seg(duration === d)}>
                {d} min
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <label htmlFor="cap" className="label block">
            Cap per player, USDso
          </label>
          <input id="cap" type="number" min={1} max={100000} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="num h-9 w-32 rounded-md border border-line-strong px-3 outline-none focus:border-accent" />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="thesis" className="label block">
          Why (optional)
        </label>
        <input
          id="thesis"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          maxLength={140}
          placeholder="Funding turned negative and shorts are crowded"
          className="h-10 w-full rounded-md border border-line-strong px-3 outline-none focus:border-accent"
        />
      </div>

      {error && <ErrorBox error={new Error(error)} onClose={() => setError(null)} />}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={busy || !market}>
          {busy ? "Opening" : `Open ${duration}-minute pit`}
        </Button>
        <p className="text-sm text-muted">Your position opens at the live mark. No wallet needed.</p>
      </div>

      <p className="border-t border-line pt-4 text-sm text-muted">
        Want it on-chain? <Link href={`/new?mode=wallet${sp.toString() ? `&${sp.toString()}` : ""}`} className="text-accent hover:underline">Open the pit with a real order from your wallet</Link>.
      </p>
    </form>
  );
}
