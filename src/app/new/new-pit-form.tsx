"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { WalletButton } from "@/components/wallet-button";
import type { Address } from "viem";
import { CHAIN_ID, txUrl } from "@/lib/chain";
import type { PitMarket } from "@/lib/markets";
import { intentMessage, type PitIntent } from "@/lib/intent";
import { previewSize, useTrade } from "@/lib/use-trade";
import { fmtQty, fmtUsd } from "@/lib/scoring";
import { Card, ErrorBox, Spinner } from "@/components/ui";
import { MarginStatus } from "@/components/margin-status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = "form" | "signing" | "ordering" | "confirming" | "registering" | "done";

export default function NewPitForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const trade = useTrade();

  const [markets, setMarkets] = useState<PitMarket[] | null>(null);
  const [symbol, setSymbol] = useState(sp.get("market") ?? "BTC");
  const [side, setSide] = useState<"long" | "short">((sp.get("side") as "long" | "short") ?? "long");
  const [duration, setDuration] = useState(Number(sp.get("duration") ?? 15));
  const [cap, setCap] = useState(Number(sp.get("cap") ?? 50));
  const [thesis, setThesis] = useState(sp.get("thesis") ?? "");
  const parentId = sp.get("rematch") ?? undefined;
  const [step, setStep] = useState<Step>("form");
  const [openTx, setOpenTx] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewSize>> | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json() as Promise<{ markets: PitMarket[] }>)
      .then((j) => setMarkets(j.markets))
      .catch((e) => setApiError(String(e)));
  }, []);
  const market = useMemo(() => markets?.find((m) => m.symbol === symbol), [markets, symbol]);

  useEffect(() => {
    if (!market || !address) return setPreview(null);
    let stop = false;
    previewSize(market, address, side === "long", cap)
      .then((p) => !stop && setPreview(p))
      .catch(() => !stop && setPreview(null));
    return () => {
      stop = true;
    };
  }, [market, address, side, cap]);

  async function create() {
    if (!market || !address) return;
    setApiError(null);
    trade.setError(null);
    const intent: PitIntent = {
      app: "OpenPit",
      chainId: CHAIN_ID,
      market: market.symbol,
      pool: market.pool,
      side,
      durationMin: duration,
      capUsd: cap,
      thesis: thesis.trim(),
      creator: address,
      nonce: crypto.randomUUID(),
    };
    try {
      setStep("signing");
      const signature = await signMessageAsync({ message: intentMessage(intent) });
      setStep("ordering");
      const { hash } = await trade.openFor(market, side === "long", cap);
      setOpenTx(hash);
      setStep("registering");
      const res = await fetch("/api/pits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent, signature, openTx: hash, parentId, market: { marginBank: market.marginBank, baseDecimals: market.baseDecimals, tickSize: market.tickSize, lotSize: market.lotSize, minQuantity: market.minQuantity } }),
      });
      const j = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "server rejected the pit");
      setStep("done");
      router.push(`/pit/${j.id}`);
    } catch (e) {
      if (!trade.error) setApiError((e as Error).message);
      setStep("form");
    }
  }

  const capRaw = BigInt(Math.round(cap * 1e6)) * 10n ** 12n;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Open a pit {parentId && <span className="font-body text-sm font-normal text-muted">(rematch)</span>}</h1>
      <p className="text-sm text-muted">You sign the pit intent, then place a real opening order from your wallet. The pit goes live only after that order is confirmed and verified on-chain.</p>

      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Market</label>
          {!markets ? (
            <Spinner />
          ) : (
            <div className="flex flex-wrap gap-2">
              {markets.map((m) => (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} className={cn("rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all active:scale-95", symbol === m.symbol ? "border-accent bg-surface-2 text-accent" : "border-line bg-surface hover:border-muted")}>
                  {m.symbol}
                  {m.markPrice && <span className="ml-1 tabular text-xs font-normal text-muted">{fmtUsd(BigInt(m.markPrice), 0)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Your call</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSide("long")} className={cn("rounded-2xl border py-4 text-xl font-black transition-all active:scale-[0.98]", side === "long" ? "border-long bg-long text-accent-ink" : "border-line text-muted hover:border-muted")}>
              LONG
            </button>
            <button onClick={() => setSide("short")} className={cn("rounded-2xl border py-4 text-xl font-black transition-all active:scale-[0.98]", side === "short" ? "border-fade bg-fade text-accent-ink" : "border-line text-muted hover:border-muted")}>
              SHORT
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">Joiners pick LONG (with you) or FADE (against you).</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Duration</label>
            <div className="flex gap-2">
              {[5, 15, 30].map((d) => (
                <button key={d} onClick={() => setDuration(d)} className={cn("flex-1 rounded-xl border py-1.5 text-sm font-semibold transition-all active:scale-95", duration === d ? "border-accent bg-surface-2 text-accent" : "border-line hover:border-muted")}>
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Cap per trader (USDso)</label>
            <input type="number" min={1} max={100000} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="w-full rounded-xl border border-line bg-bg px-3 py-2 tabular outline-none focus:border-accent" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Thesis (optional, one line)</label>
          <input maxLength={140} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="e.g. Funding flipped negative; shorts are crowded into the close" className="w-full rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-accent" />
        </div>

        {market && <MarginStatus marginBank={market.marginBank} />}

        {preview && market && (
          <div className="rounded-xl border border-line bg-bg p-3 text-xs text-muted">
            Opening order: <b className="text-fg">{side.toUpperCase()}</b> {fmtQty(preview.qty, market.baseDecimals)} {market.symbol} IOC (≈{fmtUsd((preview.qty * preview.mark) / 10n ** BigInt(market.baseDecimals))} of {fmtUsd(capRaw, 0)} cap) at mark {fmtUsd(preview.mark)}
            {!preview.priceable && <span className="ml-2 text-fade">mark price stale</span>}
            {preview.belowMin && <span className="ml-2 text-fade">below this market&apos;s minimum size — raise the cap</span>}
            {preview.priceable && !preview.belowMin && !preview.placeable && <span className="ml-2 text-fade">not placeable: {preview.limitedBy}</span>}
          </div>
        )}

        <ErrorBox error={trade.error} onClose={() => trade.setError(null)} />
        {apiError && <ErrorBox error={new Error(apiError)} onClose={() => setApiError(null)} />}

        {!address ? (
          <WalletButton />
        ) : (
          <Button variant={side === "long" ? "long" : "fade"} size="lg" className="w-full" disabled={step !== "form" || !market || !preview?.placeable} onClick={create}>
            {step === "form" && `Sign intent & open ${side.toUpperCase()}`}
            {step === "signing" && "Sign the pit intent in your wallet…"}
            {step === "ordering" && (trade.busy ?? "Placing opening order…")}
            {step === "registering" && "Verifying tx on-chain…"}
            {step === "done" && "Pit is live!"}
          </Button>
        )}
        {openTx && (
          <a href={txUrl(openTx)} target="_blank" rel="noreferrer" className="block text-center text-xs text-accent underline">
            opening order tx ↗
          </a>
        )}
      </Card>
    </div>
  );
}
