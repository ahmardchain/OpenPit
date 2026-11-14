import Link from "next/link";
import { q } from "@/lib/db";
import { who, withJoins, type PitView } from "@/lib/pit-view";
import { fmtPct, fmtUsd } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { TimeLeft } from "@/components/time-left";

export const dynamic = "force-dynamic";

function split(pit: PitView) {
  const sum = (side: "long" | "short") => pit.joins.filter((j) => j.side === side).reduce((a, j) => a + BigInt(j.notional), 0n);
  const long = sum("long");
  const short = sum("short");
  const total = long + short;
  return { long, short, longPct: total === 0n ? 50 : Number((long * 1000n) / total) / 10 };
}

function Split({ pit }: { pit: PitView }) {
  const s = split(pit);
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="bg-long" style={{ width: `${s.longPct}%` }} />
        <div className="bg-fade" style={{ width: `${100 - s.longPct}%` }} />
      </div>
      <span className="num text-xs text-muted">{Math.round(s.longPct)}% long</span>
    </div>
  );
}

const th = "py-2 pr-4 text-left font-medium label";
const td = "py-3 pr-4 align-middle";

export default async function Home() {
  const [live, settled, board] = await Promise.all([q.livePits().then(withJoins), q.settledPits(10).then(withJoins), q.leaderboard(10)]);

  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold">Short trading rounds on dreamDEX perps</h1>
        <p className="text-muted">
          Someone opens a pit on one market and calls long or short. Everyone else joins them or fades them until the bell. At the bell the mark price is
          frozen and the best return on the per-player cap wins, so a bigger account has no edge.
        </p>
        <p className="text-sm text-muted">Play with a paper position at the live dreamDEX price, no wallet needed, or place a real order on Somnia testnet.</p>
        <Button asChild size="lg">
          <Link href="/new">Open a pit</Link>
        </Button>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Open now</h2>
        {live.length === 0 ? (
          <p className="border-y border-line py-6 text-sm text-muted">
            Nothing is open. <Link href="/new" className="text-accent hover:underline">Open the first pit</Link> and send the link to someone who disagrees.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-y border-line text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Market</th>
                  <th className={th}>Call</th>
                  <th className={th}>Crowd</th>
                  <th className={th}>Players</th>
                  <th className={`${th} text-right`}>Bell in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {live.map((p) => (
                  <tr key={p.id} className="hover:bg-surface">
                    <td className={td}>
                      <Link href={`/pit/${p.id}`} className="font-medium hover:text-accent">
                        {p.market}-PERP
                      </Link>
                      {p.thesis && <div className="max-w-[260px] truncate text-xs text-muted">{p.thesis}</div>}
                    </td>
                    <td className={td}>
                      <span className={p.side === "long" ? "text-long" : "text-fade"}>{p.side === "long" ? "Long" : "Short"}</span>
                      <span className="text-muted"> by {who({ mode: p.mode, wallet: p.creator })}</span>
                    </td>
                    <td className={td}>
                      <Split pit={p} />
                    </td>
                    <td className={`${td} num`}>{p.joins.length}</td>
                    <td className={`${td} text-right`}>
                      <TimeLeft endTs={p.endTs} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Settled</h2>
          {settled.length === 0 ? (
            <p className="border-y border-line py-6 text-sm text-muted">No pit has settled yet.</p>
          ) : (
            <table className="w-full border-y border-line text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Market</th>
                  <th className={th}>Winner</th>
                  <th className={`${th} text-right`}>Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {settled.map((p) => {
                  const w = p.joins.find((j) => j.wallet.toLowerCase() === p.winner?.toLowerCase());
                  return (
                    <tr key={p.id} className="hover:bg-surface">
                      <td className={td}>
                        <Link href={`/pit/${p.id}`} className="font-medium hover:text-accent">
                          {p.market}-PERP
                        </Link>
                        <div className="text-xs text-muted">
                          {p.joins.length} players, {p.mode === "demo" ? "paper" : "on-chain"}
                        </div>
                      </td>
                      <td className={td}>{w ? who(w) : "None"}</td>
                      <td className={`${td} num text-right ${w && (w.finalRocBps ?? 0) >= 0 ? "text-long" : "text-fade"}`}>{w?.finalRocBps != null ? fmtPct(w.finalRocBps) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Best returns</h2>
          {board.length === 0 ? (
            <p className="border-y border-line py-6 text-sm text-muted">Returns appear here once a pit settles.</p>
          ) : (
            <table className="w-full border-y border-line text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Player</th>
                  <th className={th}>Pit</th>
                  <th className={`${th} text-right`}>PnL</th>
                  <th className={`${th} text-right`}>Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {board.map((r) => (
                  <tr key={`${r.pit_id}-${r.wallet}`}>
                    <td className={td}>{who(r)}</td>
                    <td className={td}>
                      <Link href={`/pit/${r.pit_id}`} className="hover:text-accent">
                        {r.market}, {r.side === "long" ? "long" : "short"}
                      </Link>
                    </td>
                    <td className={`${td} num text-right text-muted`}>{fmtUsd(BigInt(r.final_pnl))}</td>
                    <td className={`${td} num text-right ${r.final_roc_bps >= 0 ? "text-long" : "text-fade"}`}>{fmtPct(r.final_roc_bps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
