import Link from "next/link";
import { q } from "@/lib/db";
import { toView } from "@/lib/pit-view";
import { PitCard } from "@/components/pit-card";
import { fmtPct, fmtUsd } from "@/lib/scoring";
import { short } from "@/lib/chain";

export const dynamic = "force-dynamic";

export default function Home() {
  const live = q.livePits().map((p) => toView(p, q.joins(p.id)));
  const settled = q.settledPits(8).map((p) => toView(p, q.joins(p.id)));
  const board = q.leaderboard(10);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Call it. Open the pit. Let the crowd fade you.</h1>
        <p className="mt-2 max-w-xl text-zinc-300">
          A pit is a 5–30 minute window on one dreamDEX perp market. Everyone trades from their own wallet with a real testnet order; at the bell,
          return-on-cap decides the winner, so conviction beats size.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/new" className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-400">
            Open a pit
          </Link>
          <a href="https://app.testnet.dreamdex.io" target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-700 px-4 py-2 font-semibold hover:bg-zinc-800">
            Get testnet USDso
          </a>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Live pits {live.length > 0 && <span className="text-sm font-normal text-zinc-400">({live.length})</span>}</h2>
        {live.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No pit is open right now. Be the first to call one.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{live.map((p) => <PitCard key={p.id} pit={p} />)}</div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Top return-on-cap</h2>
        {board.length === 0 ? (
          <p className="text-sm text-zinc-500">Settle a pit to put someone on the board.</p>
        ) : (
          <ol className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800">
            {board.map((r, i) => (
              <li key={`${r.pit_id}-${r.wallet}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-6 text-zinc-500">{i + 1}</span>
                <span className="font-mono">{short(r.wallet)}</span>
                <span className={r.side === "long" ? "text-emerald-300" : "text-rose-300"}>{r.side}</span>
                <Link href={`/pit/${r.pit_id}`} className="text-zinc-400 hover:text-zinc-200">
                  {r.market}
                </Link>
                <span className="ml-auto tabular text-zinc-400">{fmtUsd(BigInt(r.final_pnl))}</span>
                <span className={`tabular w-20 text-right font-semibold ${r.final_roc_bps >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{fmtPct(r.final_roc_bps)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Recently settled</h2>
        {settled.length === 0 ? <p className="text-sm text-zinc-500">Nothing settled yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{settled.map((p) => <PitCard key={p.id} pit={p} />)}</div>}
      </section>
    </div>
  );
}
