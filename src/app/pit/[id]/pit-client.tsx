"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { useAccount } from "wagmi";
import type { PitView } from "@/lib/pit-view";
import { useLivePit } from "@/lib/use-live-pit";
import { useTrade } from "@/lib/use-trade";
import { fmtPct, fmtUsd } from "@/lib/scoring";
import { addrUrl, short, txUrl } from "@/lib/chain";
import { Card, Countdown, ErrorBox, Pill } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { SpotlightCard, PulseDot } from "@/components/ui/effects";
import { ExternalLink, Share2, RotateCcw, Link2 } from "lucide-react";
import { Scoreboard, scoreJoins } from "@/components/scoreboard";
import { MarginStatus } from "@/components/margin-status";

export function PitClient({ initial, appUrl }: { initial: PitView; appUrl: string }) {
  const [pit, setPit] = useState(initial);
  const { address } = useAccount();
  const trade = useTrade();
  const live = useLivePit(pit);
  const [apiError, setApiError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/pits/${pit.id}`, { cache: "no-store" });
    if (r.ok) setPit(((await r.json()) as { pit: PitView }).pit);
  }, [pit.id]);

  // Other people's joins land in the DB; pick them up every few seconds.
  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const ended = Date.now() / 1000 >= pit.endTs;
  const settle = useCallback(async () => {
    if (pit.status === "settled" || settling) return;
    setSettling(true);
    try {
      const r = await fetch(`/api/pits/${pit.id}/settle`, { method: "POST" });
      const j = (await r.json()) as { pit?: PitView; error?: string };
      if (r.ok && j.pit) setPit(j.pit);
      else if (r.status !== 409) setApiError(j.error ?? "settle failed");
    } finally {
      setSettling(false);
    }
  }, [pit.id, pit.status, settling]);

  useEffect(() => {
    if (ended && pit.status === "live") settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, pit.status]);

  const market = { pool: pit.pool, marginBank: pit.marginBank, baseDecimals: pit.baseDecimals, tickSize: pit.tickSize, lotSize: pit.lotSize, minQuantity: pit.minQuantity };
  const myJoin = address ? pit.joins.find((j) => j.wallet.toLowerCase() === address.toLowerCase()) : undefined;
  const myPos = address ? live.positions[address.toLowerCase()] : undefined;

  async function join(side: "long" | "short") {
    setApiError(null);
    try {
      const { hash } = await trade.openFor(market, side === "long", pit.capUsd);
      setLastTx(hash);
      const r = await fetch(`/api/pits/${pit.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: address, side, txHash: hash }) });
      const j = (await r.json()) as { pit?: PitView; error?: string };
      if (!r.ok || !j.pit) throw new Error(j.error ?? "join rejected");
      setPit(j.pit);
    } catch (e) {
      if (!trade.error) setApiError((e as Error).message);
    }
  }

  async function close() {
    setApiError(null);
    try {
      const { hash } = await trade.closePosition(market);
      setLastTx(hash);
      if (myJoin) {
        const r = await fetch(`/api/pits/${pit.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: address, side: myJoin.side, txHash: hash, closeOf: myJoin.id }) });
        if (r.ok) setPit(((await r.json()) as { pit: PitView }).pit);
      }
    } catch (e) {
      if (!trade.error) setApiError((e as Error).message);
    }
  }

  const fadeSide = pit.side === "long" ? "short" : "long";
  const scored = scoreJoins(pit, live.mark);
  const winner = scored[0];
  const pitUrl = `${appUrl}/pit/${pit.id}`;
  const shareText =
    pit.status === "settled"
      ? `Pit settled on ${pit.market}-PERP: ${winner ? `${short(winner.wallet)} took it with ${fmtPct(winner.roc ?? 0)} return-on-cap` : "no joiners"}. Rematch? @DreamDEXSomnia #OpenPit`
      : `I opened a ${pit.durationMin}-min ${pit.side.toUpperCase()} pit on ${pit.market}-PERP${pit.thesis ? `: "${pit.thesis}"` : ""}. Join me or fade me with a real order on @DreamDEXSomnia #OpenPit`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pitUrl)}`;
  const rematchUrl = `/new?rematch=${pit.id}&market=${pit.market}&side=${pit.side}&duration=${pit.durationMin}&cap=${pit.capUsd}&thesis=${encodeURIComponent(pit.thesis)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{pit.market}-PERP</h1>
            <Pill tone={pit.side === "long" ? "green" : "red"}>creator {pit.side.toUpperCase()}</Pill>
            {pit.status === "live" ? <Pill tone="amber"><PulseDot className="mr-1" /> live</Pill> : <Pill>settled</Pill>}
          </div>
          {pit.thesis && <p className="mt-1 text-fg/90">“{pit.thesis}”</p>}
          <p className="mt-1 text-xs text-muted">
            by{" "}
            <a className="font-mono hover:underline" href={addrUrl(pit.creator)} target="_blank" rel="noreferrer">
              {short(pit.creator)}
            </a>{" "}
            · cap {fmtUsd(BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n, 0)} per trader · {pit.durationMin} min ·{" "}
            <a className="inline-flex items-center gap-0.5 hover:underline" href={txUrl(pit.openTx)} target="_blank" rel="noreferrer">
              opening order <ExternalLink className="size-3" />
            </a>{" "}
            · intent signed (EIP-191)
          </p>
        </div>
        <div className="text-right">
          {pit.status === "live" ? (
            <>
              <Countdown endTs={pit.endTs} onZero={settle} />
              <div className="text-[10px] uppercase tracking-wider text-muted">until the bell</div>
            </>
          ) : (
            <div className="text-sm text-muted">🔔 bell rang · block {pit.endBlock}</div>
          )}
        </div>
      </div>

      {pit.status === "settled" && (
        <SpotlightCard className="border-accent p-4">
          {winner && winner.roc !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-accent">Winner by return-on-cap</div>
                <div className="display text-xl font-bold">
                  🏆 <span className="font-mono">{short(winner.wallet)}</span> <span className={winner.roc >= 0 ? "text-long" : "text-fade"}>{fmtPct(winner.roc)}</span>
                  <span className="ml-2 font-body text-sm text-muted">{winner.pnl !== null && fmtUsd(winner.pnl)} on a {fmtUsd(BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n, 0)} cap</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="secondary" size="sm">
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    <Share2 /> Share on X
                  </a>
                </Button>
                <Button asChild size="sm">
                  <Link href={rematchUrl}>
                    <RotateCcw /> Rematch
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div>No scored joins.</div>
          )}
        </SpotlightCard>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Live card</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            {live.source === "reactivity" ? "● somnia reactivity" : live.source === "poll" ? "○ 2s poll" : "connecting…"} · {live.updates} updates
          </span>
        </div>
        <Scoreboard pit={pit} live={live} me={address} />
      </Card>

      <Card className="space-y-3">
        <MarginStatus marginBank={pit.marginBank} />
        <ErrorBox error={trade.error} onClose={() => trade.setError(null)} />
        {apiError && <ErrorBox error={new Error(apiError)} onClose={() => setApiError(null)} />}
        {!address ? (
          <WalletButton />
        ) : pit.status === "live" && !ended ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="long" size="xl" className="h-24 flex-col gap-0" disabled={!!trade.busy} onClick={() => join(pit.side)}>
                {pit.side === "long" ? "LONG" : "SHORT"}
                <span className="text-xs font-semibold opacity-70">with the creator</span>
              </Button>
              <Button variant="fade" size="xl" className="h-24 flex-col gap-0" disabled={!!trade.busy} onClick={() => join(fadeSide)}>
                FADE
                <span className="text-xs font-semibold opacity-70">go {fadeSide}</span>
              </Button>
            </div>
            <p className="text-center text-xs text-muted">{trade.busy ?? `Sizes a crossing IOC for up to ${pit.capUsd} USDso, clamped by getMaxPerpOrderSize. Your wallet signs; the server only verifies the hash.`}</p>
          </>
        ) : (
          <div className="space-y-2">
            {myPos && myPos.size !== 0n ? (
              <Button variant="secondary" size="lg" className="w-full" disabled={!!trade.busy} onClick={close}>
                {trade.busy ?? "Close your position (reduce-only IOC)"}
              </Button>
            ) : (
              <p className="text-center text-sm text-muted">{myJoin ? "Your position on this market is flat." : "You did not trade in this pit."}</p>
            )}
            <div className="flex justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <Share2 /> Share on X
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={rematchUrl}>
                  <RotateCcw /> Rematch
                </Link>
              </Button>
            </div>
          </div>
        )}
        {lastTx && (
          <a href={txUrl(lastTx)} target="_blank" rel="noreferrer" className="block text-center text-xs text-accent underline">
            your last tx ↗
          </a>
        )}
      </Card>

      {pit.status === "live" && (
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={shareUrl} target="_blank" rel="noreferrer">
              <Share2 /> Share on X
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(pitUrl)}>
            <Link2 /> Copy link
          </Button>
        </div>
      )}
    </div>
  );
}
