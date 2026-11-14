"use client";
import type { LiveState } from "@/lib/use-live-pit";
import { who, type JoinView, type PitView } from "@/lib/pit-view";
import { fmtPct, fmtQty, fmtUsd, returnOnCapBps, sessionPnl } from "@/lib/scoring";
import { addrUrl, txUrl } from "@/lib/chain";
import { AnimateDigits } from "@/components/digits";
import { cn } from "@/lib/utils";

export type ScoredJoin = JoinView & { pnl: bigint | null; roc: number | null };

/** Scores every join against the frozen mark (settled) or the live mark. Same cap denominator for everyone. */
export function scoreJoins(pit: PitView, liveMark: bigint | null): ScoredJoin[] {
  const capRaw = BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n;
  const settled = pit.status === "settled";
  const m = settled && pit.endMark ? BigInt(pit.endMark) : liveMark;
  return pit.joins
    .map((j) => {
      const pnl = settled && j.finalPnl !== null ? BigInt(j.finalPnl) : m ? sessionPnl(j.side, BigInt(j.qty), BigInt(j.entry), m, pit.baseDecimals) : null;
      const roc = settled && j.finalRocBps !== null ? j.finalRocBps : pnl !== null ? returnOnCapBps(pnl, capRaw) : null;
      return { ...j, pnl, roc };
    })
    .sort((a, b) => (b.roc ?? -1e9) - (a.roc ?? -1e9));
}

export function markOf(pit: PitView, live: LiveState) {
  return pit.status === "settled" && pit.endMark ? BigInt(pit.endMark) : live.mark;
}

export function PriceStrip({ pit, live }: { pit: PitView; live: LiveState }) {
  const mark = markOf(pit, live);
  const start = BigInt(pit.startMark);
  const move = mark && start > 0n ? Number(((mark - start) * 100_000n) / start) / 1000 : null;
  const settled = pit.status === "settled";
  const since = move === null ? "" : `${move > 0 ? "+" : ""}${move.toFixed(3)}%`;
  return (
    <div className="flex flex-wrap items-end gap-x-9 gap-y-3">
      <div>
        <div className="label">{settled ? "Mark at the bell" : "Mark"}</div>
        <div className="num text-[32px] font-medium tracking-tight">{mark ? <AnimateDigits value={fmtUsd(mark)} /> : "Loading"}</div>
      </div>
      <div>
        <div className="label">Since open</div>
        <div className={`num text-xl font-medium ${move === null ? "" : move >= 0 ? "text-long" : "text-fade"}`}>{since ? <AnimateDigits value={since} /> : ""}</div>
      </div>
      <div className="text-xs text-muted">
        Opened at {fmtUsd(start)}
        <br />
        {settled ? `Frozen at block ${pit.endBlock}` : live.source === "reactivity" ? `Live via Somnia Reactivity${live.block ? `, block ${live.block}` : ""}` : live.source === "poll" ? "Live, polling every 2 s" : "Connecting"}
      </div>
    </div>
  );
}

export function CrowdSplit({ pit }: { pit: PitView }) {
  const sideOf = (s: "long" | "short") => pit.joins.filter((j) => j.side === s);
  const sum = (js: JoinView[]) => js.reduce((a, j) => a + BigInt(j.notional), 0n);
  const longs = sideOf("long");
  const shorts = sideOf("short");
  const total = sum(longs) + sum(shorts);
  const longPct = total === 0n ? 50 : Number((sum(longs) * 1000n) / total) / 10;
  return (
    <div>
      <div className="flex h-[5px] overflow-hidden rounded-sm bg-line" aria-hidden>
        <div className="bg-long transition-[width] duration-500" style={{ width: `${longPct}%` }} />
        <div className="bg-fade transition-[width] duration-500" style={{ width: `${100 - longPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-sm">
        <span>
          <span className="text-long">Long</span> <span className="num">{fmtUsd(sum(longs), 0)}</span>
          <span className="text-muted">, {longs.length} {longs.length === 1 ? "player" : "players"}</span>
        </span>
        <span>
          <span className="text-fade">Short</span> <span className="num">{fmtUsd(sum(shorts), 0)}</span>
          <span className="text-muted">, {shorts.length} {shorts.length === 1 ? "player" : "players"}</span>
        </span>
      </div>
    </div>
  );
}

const th = "py-2 pr-3.5 text-left font-medium label";
const td = "py-2.5 pr-3.5 align-middle";

export function Standings({ pit, rows, me }: { pit: PitView; rows: ScoredJoin[]; me?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>#</th>
            <th className={th}>Player</th>
            <th className={th}>Side</th>
            <th className={`${th} hidden text-right sm:table-cell`}>Entry</th>
            <th className={`${th} hidden text-right sm:table-cell`}>PnL</th>
            <th className={`${th} text-right`}>Return</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const mine = Boolean(me && r.wallet.toLowerCase() === me.toLowerCase());
            const lead = i === 0;
            return (
              <tr key={r.id} className={cn("border-b border-line hover:bg-surface", mine && !lead && "bg-accent/[0.06]")}>
                <td className={cn("num text-muted", td, lead && "pl-2.5 shadow-[inset_2px_0_0_var(--bell)]", mine && !lead && "pl-2.5 shadow-[inset_2px_0_0_var(--accent)]")}>{i + 1}</td>
                <td className={td}>
                  {r.mode === "chain" ? (
                    <a href={addrUrl(r.wallet)} target="_blank" rel="noreferrer" className="num hover:text-accent">
                      {who(r)}
                    </a>
                  ) : (
                    who(r)
                  )}
                  {mine && <span className="ml-1.5 text-[11px] text-accent">you</span>}
                  {r.wallet.toLowerCase() === pit.creator.toLowerCase() && <span className="ml-1.5 text-[11px] text-muted">creator</span>}
                </td>
                <td className={cn(td, r.side === "long" ? "text-long" : "text-fade")}>{r.side === "long" ? "Long" : "Short"}</td>
                <td className={cn("num hidden text-right text-muted sm:table-cell", td)}>{fmtUsd(BigInt(r.entry))}</td>
                <td className={cn("num hidden text-right sm:table-cell", td, r.pnl === null ? "" : r.pnl >= 0n ? "text-long" : "text-fade")}>{r.pnl === null ? "" : fmtUsd(r.pnl)}</td>
                <td className={cn("num text-right font-medium", td, "pr-0", r.roc === null ? "" : r.roc >= 0 ? "text-long" : "text-fade")}>
                  {r.roc === null ? "" : <AnimateDigits value={fmtPct(r.roc)} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Activity({ pit }: { pit: PitView }) {
  const time = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <ul className="border-t border-line text-[13.5px]">
      {[...pit.joins].reverse().map((j) => (
        <li key={j.id} className="flex flex-wrap items-baseline gap-x-2.5 border-b border-line py-2">
          <span className="num text-xs text-muted">{time(j.ts)}</span>
          <span>{who(j)}</span>
          <span className="text-muted">went</span>
          <span className={j.side === "long" ? "text-long" : "text-fade"}>{j.side}</span>
          <span className="text-muted">
            {fmtQty(BigInt(j.qty), pit.baseDecimals)} {pit.market} at <span className="num">{fmtUsd(BigInt(j.entry))}</span>
          </span>
          <span className="ml-auto text-xs">
            {j.txHash ? (
              <a href={txUrl(j.txHash)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                order tx
              </a>
            ) : (
              <span className="text-muted">paper, block {j.blockNumber}</span>
            )}
            {j.closeTx && (
              <a href={txUrl(j.closeTx)} target="_blank" rel="noreferrer" className="ml-3 text-accent hover:underline">
                close tx
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
