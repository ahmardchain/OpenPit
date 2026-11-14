"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MarketRow } from "@/lib/markets-server";
import { usePlayerName, validName } from "@/lib/player";
import { fmtUsd } from "@/lib/scoring";
import { ErrorBox } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { fieldClass, Segmented } from "@/components/segmented";
import { Spotlight } from "@/components/spotlight";
import { cn } from "@/lib/utils";
import { ModeField } from "./mode-field";

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
    <form onSubmit={submit} className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <ModeField />
        <div className="mb-[22px] flex flex-col gap-2">
          <label htmlFor="name" className="label">
            Your name
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="e.g. satoshi_fade" className={cn(fieldClass, "max-w-xs")} />
        </div>

        <fieldset className="mb-[22px] flex flex-col gap-2">
          <legend className="label">Market</legend>
          {!markets ? (
            <p className="text-sm text-muted">Loading markets from dreamDEX</p>
          ) : (
            <Segmented label="Market" value={symbol} onChange={setSymbol} options={markets.map((m) => ({ value: m.symbol, label: m.symbol }))} />
          )}
          {market?.markPrice && (
            <p className="text-xs text-muted">
              {market.symbol}-PERP mark <span className="num text-fg">{fmtUsd(BigInt(market.markPrice))}</span>
            </p>
          )}
        </fieldset>

        <fieldset className="mb-[22px] flex flex-col gap-2">
          <legend className="label">Your call</legend>
          <div className="grid max-w-[360px] grid-cols-2 gap-2">
            <button type="button" onClick={() => setSide("long")} className={cn("h-11 rounded-md border font-medium", side === "long" ? "border-long bg-long text-[#04150e]" : "border-line-strong text-muted hover:bg-surface")}>
              Long
            </button>
            <button type="button" onClick={() => setSide("short")} className={cn("h-11 rounded-md border font-medium", side === "short" ? "border-fade bg-fade text-white" : "border-line-strong text-muted hover:bg-surface")}>
              Short
            </button>
          </div>
        </fieldset>

        <div className="mb-[22px] flex flex-wrap gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="label">Length</legend>
            <Segmented
              label="Length"
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
              options={[5, 15, 30].map((d) => ({ value: String(d), label: `${d} min` }))}
            />
          </fieldset>
          <div className="flex flex-col gap-2">
            <label htmlFor="cap" className="label">
              Cap per player, USDso
            </label>
            <input id="cap" type="number" min={1} max={100000} value={cap} onChange={(e) => setCap(Number(e.target.value))} className={cn(fieldClass, "num w-32")} />
          </div>
        </div>

        <div className="mb-[22px] flex flex-col gap-2">
          <label htmlFor="thesis" className="label">
            Why (optional)
          </label>
          <input id="thesis" value={thesis} onChange={(e) => setThesis(e.target.value)} maxLength={140} placeholder="Funding turned negative and shorts are crowded" className={fieldClass} />
        </div>

        {error && <ErrorBox error={new Error(error)} onClose={() => setError(null)} />}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={busy || !market}>
            {busy ? "Opening" : `Open ${duration}-minute pit`}
          </Button>
          <p className="text-xs text-muted">Your position opens at the live mark. No wallet needed.</p>
        </div>
      </div>

      <Spotlight className="p-5 lg:sticky lg:top-[76px]">
        <div className="label">Preview</div>
        <div className="mt-2 text-[22px] font-semibold tracking-tight">{symbol}-PERP</div>
        <p className="mt-1 text-xs text-muted">
          {name.trim() || "your name"} · <span className={side === "long" ? "text-long" : "text-fade"}>{side}</span> · {duration} minutes · ${cap || 0} cap · paper
        </p>
        {thesis.trim() && <p className="mt-2">{thesis}</p>}
        <div className="mt-4">
          <div className="label">Live mark</div>
          <div className="num mt-1 text-[26px] font-medium tracking-tight">{market?.markPrice ? fmtUsd(BigInt(market.markPrice)) : "—"}</div>
        </div>
        <p className="mt-4 text-xs text-muted">Share the pit link. Anyone can join or fade until the bell.</p>
      </Spotlight>
    </form>
  );
}
