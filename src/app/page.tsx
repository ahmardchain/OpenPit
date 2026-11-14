import Link from "next/link";
import { ArrowRight, Droplets, Trophy } from "lucide-react";
import { q } from "@/lib/db";
import { toView } from "@/lib/pit-view";
import { PitCard } from "@/components/pit-card";
import { fmtPct, fmtUsd } from "@/lib/scoring";
import { short } from "@/lib/chain";
import { Button } from "@/components/ui/button";
import { BlurFade, ShinyText } from "@/components/ui/effects";

export const dynamic = "force-dynamic";

export default function Home() {
  const live = q.livePits().map((p) => toView(p, q.joins(p.id)));
  const settled = q.settledPits(8).map((p) => toView(p, q.joins(p.id)));
  const board = q.leaderboard(10);

  return (
    <div className="space-y-10">
      <BlurFade>
        <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs uppercase tracking-wider text-muted">
            <span className="size-1.5 rounded-full bg-long" /> Real orders on dreamDEX perps
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Call it. Open the pit.
            <br />
            <ShinyText>Let the crowd fade you.</ShinyText>
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            A pit is a 5–30 minute window on one perp market. Everyone trades from their own wallet; at the bell, <b className="text-fg">return-on-cap</b> decides the winner — so
            conviction beats size.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href="/new">
                Open a pit <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="https://app.testnet.dreamdex.io" target="_blank" rel="noreferrer">
                <Droplets /> Get testnet USDso
              </a>
            </Button>
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.05}>
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            Live pits {live.length > 0 && <span className="rounded-full bg-surface-2 px-2 text-xs text-accent">{live.length}</span>}
          </h2>
          {live.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">No pit is open right now. Be the first to call one.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">{live.map((p) => <PitCard key={p.id} pit={p} />)}</div>
          )}
        </section>
      </BlurFade>

      <BlurFade delay={0.1}>
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Trophy className="size-4 text-accent" /> Top return-on-cap
          </h2>
          {board.length === 0 ? (
            <p className="text-sm text-muted">Settle a pit to put someone on the board.</p>
          ) : (
            <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {board.map((r, i) => (
                <li key={`${r.pit_id}-${r.wallet}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}>{i + 1}</span>
                  <span className="font-mono">{short(r.wallet)}</span>
                  <span className={r.side === "long" ? "text-long" : "text-fade"}>{r.side}</span>
                  <Link href={`/pit/${r.pit_id}`} className="text-muted hover:text-fg">
                    {r.market}
                  </Link>
                  <span className="ml-auto tabular text-muted">{fmtUsd(BigInt(r.final_pnl))}</span>
                  <span className={`tabular w-20 text-right font-semibold ${r.final_roc_bps >= 0 ? "text-long" : "text-fade"}`}>{fmtPct(r.final_roc_bps)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </BlurFade>

      <BlurFade delay={0.15}>
        <section>
          <h2 className="mb-3 text-lg font-bold">Recently settled</h2>
          {settled.length === 0 ? <p className="text-sm text-muted">Nothing settled yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{settled.map((p) => <PitCard key={p.id} pit={p} />)}</div>}
        </section>
      </BlurFade>
    </div>
  );
}
