"use client";
import type { LiveState } from "@/lib/use-live-pit";
import type { PitView } from "@/lib/pit-view";
import { fmtPct, fmtQty, fmtUsd, returnOnCapBps, sessionPnl } from "@/lib/scoring";
import { short, txUrl, addrUrl } from "@/lib/chain";
import { Pill } from "./ui";
import { CountUp, CrowdBar } from "./ui/effects";

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
        <Stat label={pit.status === "settled" ? "Frozen mark" : "Mark"} value={mark ? <CountUp value={Number(mark) / 1e18} format={(n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /> : "—"} sub={pit.status === "settled" ? `block ${pit.endBlock}` : live.block ? `block ${live.block}` : "…"} />
        <Stat label="Since open" value={move === null ? "—" : `${move > 0 ? "+" : ""}${move.toFixed(3)}%`} tone={move === null ? undefined : move >= 0 ? "green" : "red"} sub={`from ${fmtUsd(startMark)}`} />
        <Stat label="Crowd long" value={fmtUsd(longNotional, 0)} tone="green" sub={`${pit.joins.filter((j) => j.side === "long").length} traders`} />
        <Stat label="Crowd fade" value={fmtUsd(shortNotional, 0)} tone="red" sub={`${pit.joins.filter((j) => j.side === "short").length} traders`} />
      </div>

      <div>
        <CrowdBar longPct={longPct} />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{longPct.toFixed(0)}% long</span>
          <span>{(100 - longPct).toFixed(0)}% fade</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-2 py-2 sm:px-3">#</th>
              <th className="px-2 py-2 sm:px-3">Trader</th>
              <th className="px-2 py-2 sm:px-3">Side</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">Entry</th>
              <th className="px-2 py-2 sm:px-3 text-right">PnL</th>
              <th className="px-2 py-2 sm:px-3 text-right" title="Return on cap">RoC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => {
              const isMe = me && r.wallet.toLowerCase() === me.toLowerCase();
              const isWinner = pit.status === "settled" && pit.winner?.toLowerCase() === r.wallet.toLowerCase() && i === 0;
              return (
                <tr key={r.id} className={`transition-colors ${isMe || isWinner ? "bg-surface" : ""}`}>
                  <td className="px-2 py-2 sm:px-3 text-muted">{isWinner ? "🏆" : i + 1}</td>
                  <td className="px-2 py-2 sm:px-3 font-mono">
                    <a href={addrUrl(r.wallet)} target="_blank" rel="noreferrer" className="hover:underline">
                      {short(r.wallet)}
                    </a>
                    {isMe && <span className="ml-1 font-body text-xs text-accent">you</span>}
                    {r.wallet.toLowerCase() === pit.creator.toLowerCase() && <span className="ml-1 font-body text-xs text-muted">creator</span>}
                  </td>
                  <td className="px-2 py-2 sm:px-3">
                    <Pill tone={r.side === "long" ? "green" : "red"}>{r.side === pit.side ? r.side.toUpperCase() : "FADE"}</Pill>
                  </td>
                  <td className="tabular hidden px-3 py-2 text-right text-muted sm:table-cell">
                    {fmtQty(BigInt(r.qty), pit.baseDecimals)} @ {fmtUsd(BigInt(r.entry))}
                  </td>
                  <td className={`tabular px-2 py-2 sm:px-3 text-right ${r.pnl === null ? "" : r.pnl >= 0n ? "text-long" : "text-fade"}`}>{r.pnl === null ? "—" : fmtUsd(r.pnl)}</td>
                  <td className={`tabular px-2 py-2 sm:px-3 text-right font-semibold ${r.roc === null ? "" : r.roc >= 0 ? "text-long" : "text-fade"}`}>{r.roc === null ? "—" : fmtPct(r.roc)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 font-body text-xs font-semibold uppercase tracking-wider text-muted">Recent joins</h3>
        <ul className="space-y-1 text-xs">
          {[...pit.joins].reverse().map((j) => (
            <li key={j.id} className="flex items-center gap-2 text-muted">
              <span className="font-mono">{short(j.wallet)}</span>
              <span className={j.side === "long" ? "text-long" : "text-fade"}>{j.side === pit.side ? j.side : "fade"}</span>
              <span>{fmtUsd(BigInt(j.notional), 0)}</span>
              <a href={txUrl(j.txHash)} target="_blank" rel="noreferrer" className="ml-auto text-accent hover:underline">
                tx ↗
              </a>
              {j.closeTx && (
                <a href={txUrl(j.closeTx)} target="_blank" rel="noreferrer" className="text-muted hover:underline">
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

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`tabular text-lg font-bold ${tone === "green" ? "text-long" : tone === "red" ? "text-fade" : ""}`}>{value}</div>
      {sub && <div className="truncate text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
