import Link from "next/link";
import type { PitView } from "@/lib/pit-view";
import { fmtPct, fmtUsd } from "@/lib/scoring";
import { short } from "@/lib/chain";
import { Pill } from "./ui";

export function PitCard({ pit }: { pit: PitView }) {
  const longs = pit.joins.filter((j) => j.side === "long").length;
  const shorts = pit.joins.length - longs;
  const winner = pit.joins.find((j) => j.wallet.toLowerCase() === pit.winner?.toLowerCase());
  return (
    <Link href={`/pit/${pit.id}`} className="block rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-amber-500/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{pit.market}-PERP</span>
          <Pill tone={pit.side === "long" ? "green" : "red"}>creator {pit.side.toUpperCase()}</Pill>
        </div>
        {pit.status === "live" ? <Pill tone="amber">● live · {pit.durationMin}m</Pill> : <Pill>settled</Pill>}
      </div>
      {pit.thesis && <p className="mt-2 line-clamp-2 text-sm text-zinc-300">“{pit.thesis}”</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span>cap {fmtUsd(BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n, 0)}</span>
        <span className="text-emerald-300">{longs} long</span>
        <span className="text-rose-300">{shorts} fade</span>
        <span>by {short(pit.creator)}</span>
        {winner && winner.finalRocBps !== null && (
          <span className="ml-auto font-semibold text-amber-300">
            🏆 {short(winner.wallet)} {fmtPct(winner.finalRocBps)}
          </span>
        )}
      </div>
    </Link>
  );
}
