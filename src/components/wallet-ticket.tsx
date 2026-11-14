"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import type { PitView } from "@/lib/pit-view";
import type { LiveState } from "@/lib/use-live-pit";
import { useTrade } from "@/lib/use-trade";
import { txUrl } from "@/lib/chain";
import { ErrorBox } from "./ui";
import { Button } from "./ui/button";
import { MarginStatus } from "./margin-status";
import { WalletButton } from "./wallet-button";

/** Real orders: the connected wallet signs a crossing IOC on the dreamDEX PerpPool; the server only verifies the receipt. */
export function WalletTicket({ pit, live, open, onPit }: { pit: PitView; live: LiveState; open: boolean; onPit: (p: PitView) => void }) {
  const { address } = useAccount();
  const trade = useTrade();
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const market = { pool: pit.pool, marginBank: pit.marginBank, baseDecimals: pit.baseDecimals, tickSize: pit.tickSize, lotSize: pit.lotSize, minQuantity: pit.minQuantity };
  const myJoin = address ? pit.joins.find((j) => j.wallet.toLowerCase() === address.toLowerCase()) : undefined;
  const myPos = address ? live.positions[address.toLowerCase()] : undefined;

  async function post(body: object) {
    const r = await fetch(`/api/pits/${pit.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as { pit?: PitView; error?: string };
    if (!r.ok || !j.pit) throw new Error(j.error ?? "The server did not accept the order.");
    onPit(j.pit);
  }

  async function join(side: "long" | "short") {
    setApiError(null);
    try {
      const { hash } = await trade.openFor(market, side === "long", pit.capUsd);
      setLastTx(hash);
      await post({ wallet: address, side, txHash: hash });
    } catch (e) {
      if (!trade.error) setApiError((e as Error).message);
    }
  }

  async function close() {
    setApiError(null);
    try {
      const { hash } = await trade.closePosition(market);
      setLastTx(hash);
      if (myJoin) await post({ wallet: address, side: myJoin.side, txHash: hash, closeOf: myJoin.id });
    } catch (e) {
      if (!trade.error) setApiError((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {!address ? (
        <>
          <p className="text-sm text-muted">Connect a browser wallet on Somnia Hideki. It needs a little STT for gas and USDso in its dreamDEX perps account.</p>
          <WalletButton />
        </>
      ) : (
        <>
          <MarginStatus marginBank={pit.marginBank} />
          {open && !myJoin && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="long" disabled={!!trade.busy} onClick={() => join("long")}>
                Buy long
              </Button>
              <Button variant="fade" disabled={!!trade.busy} onClick={() => join("short")}>
                Sell short
              </Button>
            </div>
          )}
          {myPos && myPos.size !== 0n && !open && (
            <Button variant="outline" className="w-full" disabled={!!trade.busy} onClick={close}>
              Close my position
            </Button>
          )}
          <p className="text-xs text-muted">{trade.busy ?? `A market order worth up to ${pit.capUsd} USDso, sized with getMaxPerpOrderSize.`}</p>
        </>
      )}
      <ErrorBox error={trade.error} onClose={() => trade.setError(null)} />
      {apiError && <ErrorBox error={new Error(apiError)} onClose={() => setApiError(null)} />}
      {lastTx && (
        <a href={txUrl(lastTx)} target="_blank" rel="noreferrer" className="block text-xs text-accent hover:underline">
          View your last transaction
        </a>
      )}
    </div>
  );
}
