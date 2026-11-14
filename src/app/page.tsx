import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { q } from "@/lib/db";
import { who, withJoins, type PitView } from "@/lib/pit-view";
import { fmtPct, fmtQty, fmtUsd } from "@/lib/scoring";
import { txUrl } from "@/lib/chain";
import { readMark } from "@/lib/server-chain";
import { Button } from "@/components/ui/button";
import { TimeLeft } from "@/components/time-left";

export const dynamic = "force-dynamic";

function notionals(pit: PitView) {
  const sum = (side: "long" | "short") => pit.joins.filter((j) => j.side === side).reduce((a, j) => a + BigInt(j.notional), 0n);
  const long = sum("long");
  const short = sum("short");
  const total = long + short;
  return { long, short, longPct: total === 0n ? 50 : Number((long * 1000n) / total) / 10, players: pit.joins.length };
}

function Split({ pit }: { pit: PitView }) {
  const s = notionals(pit);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-1 w-[88px] overflow-hidden rounded-sm bg-line" aria-hidden>
        <div className="bg-long" style={{ width: `${s.longPct}%` }} />
        <div className="bg-fade" style={{ width: `${100 - s.longPct}%` }} />
      </div>
      <span className="num text-xs text-muted">{Math.round(s.longPct)}% long</span>
    </div>
  );
}

const th = "py-2 pr-3.5 text-left font-medium label";
const td = "border-b border-line py-2.5 pr-3.5 align-middle";

function tapeItems(pits: PitView[]) {
  return pits
    .flatMap((p) =>
      p.joins.map((j) => ({
        id: `${p.id}-${j.id}`,
        ts: j.ts,
        name: who(j),
        side: j.side,
        qty: `${fmtQty(BigInt(j.qty), p.baseDecimals)} ${p.market}`,
        entry: fmtUsd(BigInt(j.entry)),
        tx: j.txHash,
      })),
    )
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 16);
}

function ActivityTape({ pits }: { pits: PitView[] }) {
  const items = tapeItems(pits);
  if (items.length === 0) return null;
  const time = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const render = (copy: string) =>
    items.map((item) => (
      <span key={`${copy}-${item.id}`} className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="num">{time(item.ts)}</span>
        <b className="font-medium text-fg">{item.name}</b>
        <span>went</span>
        <span className={item.side === "long" ? "text-long" : "text-fade"}>{item.side}</span>
        <span>
          {item.qty} at <span className="num">{item.entry}</span>
        </span>
        {item.tx ? (
          <a href={txUrl(item.tx)} className="text-accent hover:underline" target="_blank" rel="noreferrer">
            order tx
          </a>
        ) : (
          <span>paper</span>
        )}
      </span>
    ));
  return (
    <div className="relative left-1/2 -mt-7 mb-7 hidden w-screen max-w-[100vw] -translate-x-1/2 border-b border-line bg-surface min-[861px]:block" aria-label="Recent pit activity">
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
        <div className="tape-track flex w-max">
          <div className="flex gap-10 py-2 pr-10 text-xs text-muted">{render("a")}</div>
          <div className="flex gap-10 py-2 pr-10 text-xs text-muted" aria-hidden>
            {render("b")}
          </div>
        </div>
      </div>
    </div>
  );
}

function movePct(startRaw: string, mark: bigint | null) {
  const start = BigInt(startRaw);
  if (!mark || start <= 0n) return null;
  return Number(((mark - start) * 100_000n) / start) / 1000;
}

export default async function Home() {
  try {
    const [live, settled, board] = await Promise.all([q.livePits().then(withJoins), q.settledPits(10).then(withJoins), q.leaderboard(10)]);
    const featured = live[0];
    let featuredMark: bigint | null = null;
    if (featured) {
      const read = await readMark(featured.pool).catch(() => ({ ok: false as const, price: 0n }));
      featuredMark = read.ok ? read.price : null;
    }
    const featuredMove = featured ? movePct(featured.startMark, featuredMark) : null;
    const crowd = featured ? notionals(featured) : null;

    return (
      <div>
        <ActivityTape pits={[...live, ...settled]} />
        <div className="mb-9 grid items-stretch gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="flex flex-col justify-center gap-5 py-1">
            <div className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">15-minute crowd trades</div>
            <h1 className="max-w-[16ch] text-[34px] leading-[1.1] font-semibold sm:text-[40px]">Turn any dreamDEX market into a pit. Go long, or fade. The bell crowns the best return.</h1>
            <p className="max-w-xl text-muted">
              Someone opens a pit and calls a side. Everyone else joins them or fades them until the bell. The mark is frozen, and the best return on the per-player cap wins — a bigger account has no edge.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/new">Open a pit</Link>
              </Button>
              <span className="max-w-xs text-xs text-muted">Paper position at the live mark, no wallet needed — or place a real order on Hideki.</span>
            </div>
          </div>

          {featured && crowd ? (
            <Link href={`/pit/${featured.id}`} className="block rounded-lg border border-line bg-surface p-5 hover:border-line-strong">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="text-[22px] font-semibold tracking-tight">{featured.market}-PERP</div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-long/35 px-2 py-0.5 text-[11px] tracking-[0.08em] text-long uppercase">
                  <span className="size-1.5 rounded-full bg-long" aria-hidden />
                  Live
                </span>
              </div>
              <p className="text-xs text-muted">
                {who({ mode: featured.mode, wallet: featured.creator })} called <span className={featured.side === "long" ? "text-long" : "text-fade"}>{featured.side}</span> · {fmtUsd(BigInt(Math.round(featured.capUsd * 1e6)) * 10n ** 12n, 0)} cap · {featured.mode === "demo" ? "paper" : "on-chain"}
              </p>
              {featured.thesis && <p className="mt-2">{featured.thesis}</p>}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="label">Bell in</div>
                  <div className="mt-1.5">
                    <span className="sm:hidden">
                      <TimeLeft endTs={featured.endTs} />
                    </span>
                    <span className="hidden sm:inline">
                      <TimeLeft endTs={featured.endTs} size="lg" />
                    </span>
                  </div>
                </div>
                <div>
                  <div className="label">Mark</div>
                  <div className="num mt-1 text-[26px] font-medium tracking-tight">{featuredMark ? fmtUsd(featuredMark) : "—"}</div>
                  {featuredMove !== null && (
                    <div className={`num text-[13px] ${featuredMove >= 0 ? "text-long" : "text-fade"}`}>
                      {featuredMove > 0 ? "+" : ""}
                      {featuredMove.toFixed(3)}%
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex h-1 overflow-hidden rounded-sm bg-line" aria-hidden>
                <div className="bg-long" style={{ width: `${crowd.longPct}%` }} />
                <div className="bg-fade" style={{ width: `${100 - crowd.longPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[13px]">
                <span>
                  <span className="text-long">Long</span> <span className="num">{fmtUsd(crowd.long, 0)}</span> · {pitSideCount(featured, "long")}
                </span>
                <span>
                  <span className="text-fade">Short</span> <span className="num">{fmtUsd(crowd.short, 0)}</span> · {pitSideCount(featured, "short")}
                </span>
              </div>
              <p className="mt-3.5 text-xs text-muted">
                {crowd.players} {crowd.players === 1 ? "player" : "players"} · join or fade this pit →
              </p>
            </Link>
          ) : (
            <div className="flex flex-col justify-center rounded-lg border border-line bg-surface p-5">
              <div className="label">Open now</div>
              <p className="mt-2 text-lg font-semibold tracking-tight">No pit is open</p>
              <p className="mt-1 text-sm text-muted">Open one and send the link to someone who disagrees.</p>
              <Button asChild className="mt-4 self-start">
                <Link href="/new">Open a pit</Link>
              </Button>
            </div>
          )}
        </div>

        <section className="mb-10">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Open now</h2>
            <span className="text-xs text-muted">{live.length === 0 ? "None live" : `${live.length} live ${live.length === 1 ? "pit" : "pits"}`}</span>
          </div>
          {live.length === 0 ? (
            <p className="border-y border-line py-6 text-sm text-muted">
              Nothing is open.{" "}
              <Link href="/new" className="text-accent hover:underline">
                Open the first pit
              </Link>{" "}
              and send the link to someone who disagrees.
            </p>
          ) : (
            <div>
            <ul className="divide-y divide-line border-y border-line sm:hidden">
              {live.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/pit/${p.id}`} className="font-medium hover:text-accent">
                      {p.market}-PERP
                    </Link>
                    <TimeLeft endTs={p.endTs} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    <span className={p.side === "long" ? "text-long" : "text-fade"}>{p.side === "long" ? "Long" : "Short"}</span> by {who({ mode: p.mode, wallet: p.creator })}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <Split pit={p} />
                    <span className="text-xs text-muted">
                      <span className="num text-fg">{p.joins.length}</span> {p.joins.length === 1 ? "player" : "players"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Market</th>
                    <th className={th}>Call</th>
                    <th className={th}>Crowd</th>
                    <th className={th}>Players</th>
                    <th className={`${th} text-right`}>Bell in</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((p) => (
                    <tr key={p.id} className="hover:bg-surface">
                      <td className={td}>
                        <Link href={`/pit/${p.id}`} className="font-medium hover:text-accent">
                          {p.market}-PERP
                        </Link>
                        {p.thesis && <div className="max-w-[220px] truncate text-[11px] text-muted">{p.thesis}</div>}
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
            </div>
          )}
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="mb-2.5 text-base font-semibold">Settled</h2>
            {settled.length === 0 ? (
              <p className="border-y border-line py-6 text-sm text-muted">No pit has settled yet.</p>
            ) : (
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Market</th>
                    <th className={th}>Winner</th>
                    <th className={`${th} text-right`}>Return</th>
                  </tr>
                </thead>
                <tbody>
                  {settled.map((p) => {
                    const w = p.joins.find((j) => j.wallet.toLowerCase() === p.winner?.toLowerCase());
                    return (
                      <tr key={p.id} className="hover:bg-surface">
                        <td className={td}>
                          <Link href={`/pit/${p.id}`} className="font-medium hover:text-accent">
                            {p.market}-PERP
                          </Link>
                          <div className="text-[11px] text-muted">
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
            <h2 className="mb-2.5 text-base font-semibold">Best returns</h2>
            {board.length === 0 ? (
              <p className="border-y border-line py-6 text-sm text-muted">Returns appear here once a pit settles.</p>
            ) : (
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Player</th>
                    <th className={th}>Pit</th>
                    <th className={`${th} text-right`}>PnL</th>
                    <th className={`${th} text-right`}>Return</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((r) => (
                    <tr key={`${r.pit_id}-${r.wallet}`} className="hover:bg-surface">
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
  } catch (e) {
    unstable_rethrow(e);
    const message = e instanceof Error ? e.message : "Could not read pits.";
    return (
      <div className="py-8">
        <h1 className="text-xl font-semibold">Pits are unavailable</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">{message}</p>
      </div>
    );
  }
}

function pitSideCount(pit: PitView, side: "long" | "short") {
  return pit.joins.filter((j) => j.side === side).length;
}
