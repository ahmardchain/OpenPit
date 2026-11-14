"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";
import { CHAIN_ID, txUrl } from "@/lib/chain";
import type { PitMarket } from "@/lib/markets";
import { intentMessage, type PitIntent } from "@/lib/intent";
import { previewSize, useTrade } from "@/lib/use-trade";
import { fmtQty, fmtUsd } from "@/lib/scoring";
import { Card, ErrorBox, Spinner } from "@/components/ui";
import { MarginStatus } from "@/components/margin-status";

type Step = "form" | "signing" | "ordering" | "confirming" | "registering" | "done";

export default function NewPit() {
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
      .then((r) => r.json())
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
      const j = await res.json();
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
      <h1 className="text-2xl font-extrabold">Open a pit {parentId && <span className="text-sm font-normal text-zinc-400">(rematch)</span>}</h1>
      <p className="text-sm text-zinc-400">You sign the pit intent, then place a real opening order from your wallet. The pit goes live only after that order is confirmed and verified on-chain.</p>

      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">Market</label>
          {!markets ? (
            <Spinner />
          ) : (
            <div className="flex flex-wrap gap-2">
              {markets.map((m) => (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${symbol === m.symbol ? "border-amber-500 bg-amber-500/15 text-amber-200" : "border-zinc-700 hover:bg-zinc-800"}`}>
                  {m.symbol}
                  {m.markPrice && <span className="ml-1 text-xs font-normal text-zinc-400">{fmtUsd(BigInt(m.markPrice), 0)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">Your call</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSide("long")} className={`rounded-xl border py-3 text-lg font-bold ${side === "long" ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" : "border-zinc-700"}`}>
              LONG
            </button>
            <button onClick={() => setSide("short")} className={`rounded-xl border py-3 text-lg font-bold ${side === "short" ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-zinc-700"}`}>
              SHORT
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Joiners pick LONG (with you) or FADE (against you).</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">Duration</label>
            <div className="flex gap-2">
              {[5, 15, 30].map((d) => (
                <button key={d} onClick={() => setDuration(d)} className={`flex-1 rounded-lg border py-1.5 text-sm font-semibold ${duration === d ? "border-amber-500 bg-amber-500/15 text-amber-200" : "border-zinc-700"}`}>
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">Cap per trader (USDso)</label>
            <input type="number" min={1} max={100000} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 tabular" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">Thesis (optional, one line)</label>
          <input maxLength={140} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="e.g. Funding flipped negative; shorts are crowded into the close" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5" />
        </div>

        {market && <MarginStatus marginBank={market.marginBank} />}

        {preview && market && (
          <div className="rounded-xl bg-zinc-950 p-3 text-xs text-zinc-400">
            Opening order: <b className="text-zinc-200">{side.toUpperCase()}</b> {fmtQty(preview.qty, market.baseDecimals)} {market.symbol} IOC (≈{fmtUsd((preview.qty * preview.mark) / 10n ** BigInt(market.baseDecimals))} of {fmtUsd(capRaw, 0)} cap) at mark {fmtUsd(preview.mark)}
            {!preview.priceable && <span className="ml-2 text-rose-300">mark price stale</span>}
            {preview.belowMin && <span className="ml-2 text-rose-300">below this market&apos;s minimum size — raise the cap</span>}
            {preview.priceable && !preview.belowMin && !preview.placeable && <span className="ml-2 text-rose-300">not placeable: {preview.limitedBy}</span>}
          </div>
        )}

        <ErrorBox error={trade.error} onClose={() => trade.setError(null)} />
        {apiError && <ErrorBox error={new Error(apiError)} onClose={() => setApiError(null)} />}

        {!address ? (
          <ConnectButton />
        ) : (
          <button
            disabled={step !== "form" || !market || !preview?.placeable}
            onClick={create}
            className={`w-full rounded-xl py-3 text-lg font-bold text-zinc-950 disabled:opacity-50 ${side === "long" ? "bg-emerald-400" : "bg-rose-400"}`}
          >
            {step === "form" && `Sign intent & open ${side.toUpperCase()}`}
            {step === "signing" && "Sign the pit intent in your wallet…"}
            {step === "ordering" && (trade.busy ?? "Placing opening order…")}
            {step === "registering" && "Verifying tx on-chain…"}
            {step === "done" && "Pit is live!"}
          </button>
        )}
        {openTx && (
          <a href={txUrl(openTx)} target="_blank" rel="noreferrer" className="block text-center text-xs text-amber-300 underline">
            opening order tx ↗
          </a>
        )}
      </Card>
    </div>
  );
}
