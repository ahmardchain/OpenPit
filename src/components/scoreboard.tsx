"use client";
import type { LiveState } from "@/lib/use-live-pit";
import type { PitView } from "@/lib/pit-view";
import { fmtPct, fmtQty, fmtUsd, returnOnCapBps, sessionPnl } from "@/lib/scoring";
import { short, txUrl, addrUrl } from "@/lib/chain";
import { Pill } from "./ui";

export function scoreJoins(pit: PitView, mark: bigint | null) {
  const capRaw = BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n;
  const m = pit.status === "settled" && pit.endMark ? BigInt(pit.endMark) : mark;
  return pit.joins
    .map((j) => {
      const pnl = pit.status === "settled" && j.finalPnl !== null ? BigInt(j.finalPnl) : m ? sessionPnl(j.side, BigInt(j.qty), BigInt(j.entry), m, pit.baseDecimals) : null;
      const roc = pit.status === "settled" && j.finalRocBps !== null ? j.finalRocBps : pnl !== null ? returnOnCapBps(pnl, capRaw) : null;
      return { ...j, pnl, roc };
    })
    .sort((a, b) => (b.roc ?? -1e9) - (a.roc ?? -1e9));
}

export function Scoreboard({ pit, live, me }: { pit: PitView; live: LiveState; me?: string }) {
  const rows = scoreJoins(pit, live.mark);
  const longNotional = pit.joins.filter((j) => j.side === "long").reduce((a, j) => a + BigInt(j.notional), 0n);
  const shortNotional = pit.joins.filter((j) => j.side === "short").reduce((a, j) => a + BigInt(j.notional), 0n);
  const total = longNotional + shortNotional;
  const longPct = total === 0n ? 50 : Number((longNotional * 1000n) / total) / 10;
  const mark = pit.status === "settled" && pit.endMark ? BigInt(pit.endMark) : live.mark;
  const startMark = BigInt(pit.startMark);
  const move = mark && startMark > 0n ? Number(((mark - startMark) * 100_000n) / startMark) / 1000 : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={pit.status === "settled" ? "Frozen mark" : "Mark"} value={mark ? fmtUsd(mark) : "—"} sub={pit.status === "settled" ? `block ${pit.endBlock}` : live.block ? `block ${live.block}` : "…"} />
        <Stat label="Since open" value={move === null ? "—" : `${move > 0 ? "+" : ""}${move.toFixed(3)}%`} tone={move === null ? undefined : move >= 0 ? "green" : "red"} sub={`from ${fmtUsd(startMark)}`} />
        <Stat label="Crowd long" value={fmtUsd(longNotional, 0)} tone="green" sub={`${pit.joins.filter((j) => j.side === "long").length} traders`} />
        <Stat label="Crowd fade" value={fmtUsd(shortNotional, 0)} tone="red" sub={`${pit.joins.filter((j) => j.side === "short").length} traders`} />
      </div>

      <div>
        <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
          <div className="bg-emerald-400 transition-all" style={{ width: `${longPct}%` }} />
          <div className="bg-rose-400 transition-all" style={{ width: `${100 - longPct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-zinc-400">
          <span>{longPct.toFixed(0)}% long</span>
          <span>{(100 - longPct).toFixed(0)}% fade</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Trader</th>
              <th className="px-3 py-2">Side</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">Entry</th>
              <th className="px-3 py-2 text-right">PnL</th>
              <th className="px-3 py-2 text-right" title="Return on cap">RoC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((r, i) => {
              const isMe = me && r.wallet.toLowerCase() === me.toLowerCase();
              const isWinner = pit.status === "settled" && pit.winner?.toLowerCase() === r.wallet.toLowerCase() && i === 0;
              return (
                <tr key={r.id} className={isMe ? "bg-amber-500/5" : ""}>
                  <td className="px-3 py-2 text-zinc-500">{isWinner ? "🏆" : i + 1}</td>
                  <td className="px-3 py-2 font-mono">
                    <a href={addrUrl(r.wallet)} target="_blank" rel="noreferrer" className="hover:underline">
                      {short(r.wallet)}
                    </a>
                    {isMe && <span className="ml-1 text-xs text-amber-300">you</span>}
                    {r.wallet.toLowerCase() === pit.creator.toLowerCase() && <span className="ml-1 text-xs text-zinc-500">creator</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Pill tone={r.side === "long" ? "green" : "red"}>{r.side === pit.side ? r.side.toUpperCase() : "FADE"}</Pill>
                  </td>
                  <td className="tabular hidden px-3 py-2 text-right text-zinc-400 sm:table-cell">
                    {fmtQty(BigInt(r.qty), pit.baseDecimals)} @ {fmtUsd(BigInt(r.entry))}
                  </td>
                  <td className={`tabular px-3 py-2 text-right ${r.pnl === null ? "" : r.pnl >= 0n ? "text-emerald-300" : "text-rose-300"}`}>{r.pnl === null ? "—" : fmtUsd(r.pnl)}</td>
                  <td className={`tabular px-3 py-2 text-right font-semibold ${r.roc === null ? "" : r.roc >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{r.roc === null ? "—" : fmtPct(r.roc)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Recent joins</h3>
        <ul className="space-y-1 text-xs">
          {[...pit.joins].reverse().map((j) => (
            <li key={j.id} className="flex items-center gap-2 text-zinc-400">
              <span className="font-mono">{short(j.wallet)}</span>
              <span className={j.side === "long" ? "text-emerald-300" : "text-rose-300"}>{j.side === pit.side ? j.side : "fade"}</span>
              <span>{fmtUsd(BigInt(j.notional), 0)}</span>
              <a href={txUrl(j.txHash)} target="_blank" rel="noreferrer" className="ml-auto text-amber-300/80 hover:underline">
                tx ↗
              </a>
              {j.closeTx && (
                <a href={txUrl(j.closeTx)} target="_blank" rel="noreferrer" className="text-zinc-400 hover:underline">
                  closed ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="text-[10px] font-semibold uppercase text-zinc-500">{label}</div>
      <div className={`tabular text-lg font-bold ${tone === "green" ? "text-emerald-300" : tone === "red" ? "text-rose-300" : ""}`}>{value}</div>
      {sub && <div className="truncate text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}
