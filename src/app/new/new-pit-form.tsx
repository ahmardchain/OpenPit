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
import { ErrorBox, Spinner } from "@/components/ui";
import { MarginStatus } from "@/components/margin-status";
import { Button } from "@/components/ui/button";
import { fieldClass, Segmented } from "@/components/segmented";
import { Spotlight } from "@/components/spotlight";
import { cn } from "@/lib/utils";
import { who } from "@/lib/pit-view";
import { ModeField } from "./mode-field";

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
  const [quote, setPreview] = useState<Awaited<ReturnType<typeof previewSize>> | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json() as Promise<{ markets: PitMarket[] }>)
      .then((j) => setMarkets(j.markets))
      .catch((e) => setApiError(String(e)));
  }, []);
  const market = useMemo(() => markets?.find((m) => m.symbol === symbol), [markets, symbol]);
  const preview = market && address ? quote : null;

  useEffect(() => {
    if (!market || !address) return;
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

  const lengths = [5, 15, 30];
  const lengthValue = lengths.includes(duration) ? String(duration) : "";

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <ModeField />
        <p className="mb-[22px] text-sm text-muted">You sign the pit details, then place a real opening order from your wallet. The pit opens once that order is confirmed on-chain.</p>

        <div className="mb-[22px] flex flex-col gap-2">
          <span className="label">Market</span>
          {!markets ? (
            <Spinner />
          ) : (
            <Segmented label="Market" value={symbol} onChange={setSymbol} options={markets.map((m) => ({ value: m.symbol, label: m.symbol }))} />
          )}
          {market?.markPrice && (
            <p className="text-xs text-muted">
              {market.symbol}-PERP mark <span className="num text-fg">{fmtUsd(BigInt(market.markPrice))}</span>
            </p>
          )}
        </div>

        <div className="mb-[22px] flex flex-col gap-2">
          <span className="label">Your call</span>
          <div className="grid max-w-[360px] grid-cols-2 gap-2">
            <button type="button" onClick={() => setSide("long")} className={cn("h-11 rounded-md border font-medium", side === "long" ? "border-long bg-long text-[#04150e]" : "border-line-strong text-muted")}>
              Long
            </button>
            <button type="button" onClick={() => setSide("short")} className={cn("h-11 rounded-md border font-medium", side === "short" ? "border-fade bg-fade text-white" : "border-line-strong text-muted")}>
              Short
            </button>
          </div>
          <p className="text-xs text-muted">Joiners pick long (with you) or the other side (against you).</p>
        </div>

        <div className="mb-[22px] flex flex-wrap gap-6">
          <div className="flex flex-col gap-2">
            <span className="label">Length</span>
            <Segmented label="Length" value={lengthValue} onChange={(v) => setDuration(Number(v))} options={lengths.map((d) => ({ value: String(d), label: `${d} min` }))} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="wallet-cap" className="label">
              Cap per player, USDso
            </label>
            <input id="wallet-cap" type="number" min={1} max={100000} value={cap} onChange={(e) => setCap(Number(e.target.value))} className={cn(fieldClass, "num w-32")} />
          </div>
        </div>

        <div className="mb-[22px] flex flex-col gap-2">
          <label htmlFor="wallet-thesis" className="label">
            Why (optional)
          </label>
          <input id="wallet-thesis" maxLength={140} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Funding turned negative and shorts are crowded" className={fieldClass} />
        </div>

        {market && <div className="mb-[22px]"><MarginStatus marginBank={market.marginBank} /></div>}

        {preview && market && (
          <div className="mb-[22px] rounded-md border border-line bg-bg p-3 text-xs text-muted">
            Opening order: <b className="text-fg">{side === "long" ? "Long" : "Short"}</b> {fmtQty(preview.qty, market.baseDecimals)} {market.symbol} IOC (≈{fmtUsd((preview.qty * preview.mark) / 10n ** BigInt(market.baseDecimals))} of {fmtUsd(capRaw, 0)} cap) at mark {fmtUsd(preview.mark)}
            {!preview.priceable && <span className="ml-2 text-fade">mark price stale</span>}
            {preview.belowMin && <span className="ml-2 text-fade">below this market&apos;s minimum size, raise the cap</span>}
            {preview.priceable && !preview.belowMin && !preview.placeable && <span className="ml-2 text-fade">not placeable: {preview.limitedBy}</span>}
          </div>
        )}

        <ErrorBox error={trade.error} onClose={() => trade.setError(null)} />
        {apiError && <ErrorBox error={new Error(apiError)} onClose={() => setApiError(null)} />}

        <div className="mt-2">
          {!address ? (
            <WalletButton />
          ) : (
            <Button size="lg" disabled={step !== "form" || !market || !preview?.placeable} onClick={create}>
              {step === "form" && `Sign intent and open ${side}`}
              {step === "signing" && "Sign the pit intent in your wallet…"}
              {step === "ordering" && (trade.busy ?? "Placing opening order…")}
              {step === "registering" && "Verifying tx on-chain…"}
              {step === "done" && "Pit is live"}
            </Button>
          )}
        </div>
        {openTx && (
          <a href={txUrl(openTx)} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-accent underline">
            opening order tx
          </a>
        )}
      </div>

      <Spotlight className="p-5 lg:sticky lg:top-[76px]">
        <div className="label">Preview</div>
        <div className="mt-2 text-[22px] font-semibold tracking-tight">{symbol}-PERP</div>
        <p className="mt-1 text-xs text-muted">
          {address ? who({ mode: "chain", wallet: address }) : "your wallet"} · <span className={side === "long" ? "text-long" : "text-fade"}>{side}</span> · {duration} minutes · ${cap || 0} cap · wallet
        </p>
        {thesis.trim() && <p className="mt-2">{thesis}</p>}
        <div className="mt-4">
          <div className="label">Live mark</div>
          <div className="num mt-1 text-[26px] font-medium tracking-tight">{market?.markPrice ? fmtUsd(BigInt(market.markPrice)) : "—"}</div>
        </div>
        <p className="mt-4 text-xs text-muted">A real opening order on dreamDEX. The pit opens once that order is confirmed.</p>
      </Spotlight>
    </div>
  );
}
