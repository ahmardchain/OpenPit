"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PitView } from "@/lib/pit-view";
import { who } from "@/lib/pit-view";
import { useLivePit } from "@/lib/use-live-pit";
import { usePlayerName, validName } from "@/lib/player";
import { fmtPct, fmtUsd } from "@/lib/scoring";
import { addrUrl, txUrl } from "@/lib/chain";
import { clock, ErrorBox, useNow } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Activity, CrowdSplit, PriceStrip, Standings, scoreJoins } from "@/components/scoreboard";
import { WalletTicket } from "@/components/wallet-ticket";

export function PitClient({ initial, appUrl }: { initial: PitView; appUrl: string }) {
  const [pit, setPit] = useState(initial);
  const live = useLivePit(pit);
  const now = useNow();
  const [name, setName] = usePlayerName();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useWallet, setUseWallet] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/pits/${pit.id}`, { cache: "no-store" });
    if (r.ok) setPit(((await r.json()) as { pit: PitView }).pit);
  }, [pit.id]);

  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const settled = pit.status === "settled";
  const open = !settled && now < pit.endTs;

  // Anyone viewing after the bell triggers settlement; the server makes it idempotent.
  useEffect(() => {
    if (settled || now < pit.endTs) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/pits/${pit.id}/settle`, { method: "POST" });
      if (r.ok) setPit(((await r.json()) as { pit: PitView }).pit);
    }, 1500);
    return () => clearTimeout(t);
  }, [settled, now >= pit.endTs, pit.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = pit.joins.find((j) => j.mode === "demo" && j.wallet.toLowerCase() === name.trim().toLowerCase());
  const rows = scoreJoins(pit, live.mark);
  const winner = settled ? rows[0] : undefined;
  const mine = me ? rows.find((r) => r.id === me.id) : undefined;
  const cap = fmtUsd(BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n, 0);

  async function joinPaper(side: "long" | "short") {
    setError(null);
    if (!validName(name)) return setError("Pick a name of 2 to 20 letters, digits, dots, dashes or underscores.");
    setBusy(true);
    try {
      const r = await fetch(`/api/pits/${pit.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "demo", name: name.trim(), side }) });
      const j = (await r.json()) as { pit?: PitView; error?: string };
      if (!r.ok || !j.pit) throw new Error(j.error ?? "Could not join.");
      setPit(j.pit);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pitUrl = `${appUrl}/pit/${pit.id}`;
  const shareText = settled
    ? `${winner ? `${who(winner)} won my ${pit.market}-PERP pit with ${fmtPct(winner.roc ?? 0)} on the cap` : `My ${pit.market}-PERP pit settled`}. Rematch? Prices from @DreamDEXSomnia`
    : `I'm ${pit.side} ${pit.market}-PERP for the next ${clock(pit.endTs - now)}${pit.thesis ? `: ${pit.thesis}` : ""}. Join me or fade me, prices from @DreamDEXSomnia`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pitUrl)}`;
  const rematchUrl = `/new?rematch=${pit.id}&market=${pit.market}&side=${pit.side}&duration=${pit.durationMin}&cap=${pit.capUsd}&thesis=${encodeURIComponent(pit.thesis)}`;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0 space-y-1">
          <div className="text-sm text-muted">
            <Link href="/" className="hover:text-fg">
              Pits
            </Link>{" "}
            / {pit.id}
          </div>
          <h1 className="text-3xl font-semibold">{pit.market}-PERP</h1>
          <p className="text-sm text-muted">
            {who({ mode: pit.mode, wallet: pit.creator })} called <span className={pit.side === "long" ? "text-long" : "text-fade"}>{pit.side}</span> for {pit.durationMin} minutes, {cap} cap per
            player, {pit.mode === "demo" ? "paper positions" : "real orders on dreamDEX"}
          </p>
          {pit.thesis && <p className="max-w-xl pt-1">{pit.thesis}</p>}
        </div>
        <div className="sm:text-right">
          <div className="label">{settled ? "Settled" : open ? "Bell in" : "Settling"}</div>
          <div className="num text-3xl font-medium">{settled ? `#${pit.endBlock}` : clock(pit.endTs - now)}</div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          <PriceStrip pit={pit} live={live} />
          <CrowdSplit pit={pit} />
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          {settled ? (
            <div className="space-y-3 rounded-lg border border-line p-4">
              <h2 className="font-semibold">Result</h2>
              {winner && winner.roc !== null ? (
                <p>
                  {who(winner)} won with <span className={`num ${winner.roc >= 0 ? "text-long" : "text-fade"}`}>{fmtPct(winner.roc)}</span> on the {cap} cap
                  {winner.pnl !== null && <span className="text-muted"> ({fmtUsd(winner.pnl)})</span>}.
                </p>
              ) : (
                <p className="text-muted">Nobody joined this pit.</p>
              )}
              {mine && mine.roc !== null && (
                <p className="text-sm text-muted">
                  You finished {rows.indexOf(mine) + 1} of {rows.length} with <span className="num">{fmtPct(mine.roc)}</span>.
                </p>
              )}
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={rematchUrl}>Rematch</Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    Post on X
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-line p-4">
              <h2 className="font-semibold">{me ? "You're in" : "Join this pit"}</h2>
              {me ? (
                <p className="text-sm">
                  <span className={me.side === "long" ? "text-long" : "text-fade"}>{me.side === "long" ? "Long" : "Short"}</span> from <span className="num">{fmtUsd(BigInt(me.entry))}</span>.{" "}
                  {mine?.roc != null && (
                    <>
                      Right now <span className={`num ${mine.roc >= 0 ? "text-long" : "text-fade"}`}>{fmtPct(mine.roc)}</span>, rank {rows.indexOf(mine) + 1} of {rows.length}.
                    </>
                  )}
                </p>
              ) : open ? (
                <>
                  <label className="block space-y-1">
                    <span className="label">Your name</span>
                    <input
                      id="player-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={20}
                      placeholder="e.g. satoshi_fade"
                      className="h-10 w-full rounded-md border border-line-strong px-3 outline-none focus:border-accent"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="long" disabled={busy} onClick={() => joinPaper("long")}>
                      Long
                    </Button>
                    <Button variant="fade" disabled={busy} onClick={() => joinPaper("short")}>
                      Short
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    {pit.side === "long" ? "Long joins the creator, short fades them." : "Short joins the creator, long fades them."} You get a paper position worth {cap} at the current dreamDEX
                    mark. No wallet needed.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">The bell has rung.</p>
              )}
              {error && <ErrorBox error={new Error(error)} onClose={() => setError(null)} />}
              <Button asChild variant="outline" className="w-full">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  Post on X
                </a>
              </Button>
            </div>
          )}

          <div className="space-y-3 border-t border-line pt-4">
            <button onClick={() => setUseWallet((v) => !v)} className="text-sm text-accent hover:underline">
              {useWallet ? "Hide wallet trading" : "Trade a real order with a wallet"}
            </button>
            {useWallet && <WalletTicket pit={pit} live={live} open={open} onPit={setPit} />}
          </div>

          <dl className="space-y-1.5 border-t border-line pt-4 text-xs text-muted">
            <div className="flex justify-between gap-3">
              <dt>Market pool</dt>
              <dd>
                <a href={addrUrl(pit.pool)} target="_blank" rel="noreferrer" className="num hover:text-accent">
                  {who({ mode: "chain", wallet: pit.pool })}
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Opened at block</dt>
              <dd className="num">{pit.startBlock}</dd>
            </div>
            {pit.openTx && (
              <div className="flex justify-between gap-3">
                <dt>Opening order</dt>
                <dd>
                  <a href={txUrl(pit.openTx)} target="_blank" rel="noreferrer" className="num hover:text-accent">
                    {who({ mode: "chain", wallet: pit.openTx })}
                  </a>
                </dd>
              </div>
            )}
            {pit.signature && (
              <div className="flex justify-between gap-3">
                <dt>Creator signature</dt>
                <dd className="num" title={pit.signature}>
                  {who({ mode: "chain", wallet: pit.signature })}
                </dd>
              </div>
            )}
          </dl>
        </aside>
        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Standings</h2>
            <Standings pit={pit} rows={rows} me={me?.wallet} />
            <p className="text-xs text-muted">Return is PnL divided by the {cap} cap, the same for every player, so position size does not decide the winner.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Activity</h2>
            <Activity pit={pit} />
          </section>
        </div>

      </div>
    </div>
  );
}
