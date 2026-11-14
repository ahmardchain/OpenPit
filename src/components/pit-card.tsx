import Link from "next/link";
import type { PitView } from "@/lib/pit-view";
import { fmtPct, fmtUsd } from "@/lib/scoring";
import { short } from "@/lib/chain";
import { Badge } from "./ui/badge";
import { PulseDot } from "./ui/effects";

export function PitCard({ pit }: { pit: PitView }) {
  const longs = pit.joins.filter((j) => j.side === "long").length;
  const shorts = pit.joins.length - longs;
  const winner = pit.joins.find((j) => j.wallet.toLowerCase() === pit.winner?.toLowerCase());
  return (
    <Link
      href={`/pit/${pit.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent"
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${pit.side === "long" ? "bg-long" : "bg-fade"}`} />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="display text-lg font-bold">{pit.market}-PERP</span>
          <Badge variant={pit.side === "long" ? "green" : "red"}>creator {pit.side}</Badge>
        </div>
        {pit.status === "live" ? (
          <Badge variant="live">
            <PulseDot /> live · {pit.durationMin}m
          </Badge>
        ) : (
          <Badge>settled</Badge>
        )}
      </div>
      {pit.thesis && <p className="relative mt-2 line-clamp-2 text-sm text-fg/90">“{pit.thesis}”</p>}
      <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>cap {fmtUsd(BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n, 0)}</span>
        <span className="text-long">{longs} long</span>
        <span className="text-fade">{shorts} fade</span>
        <span>by {short(pit.creator)}</span>
        {winner && winner.finalRocBps !== null && (
          <span className="ml-auto font-semibold text-accent">
            🏆 {short(winner.wallet)} {fmtPct(winner.finalRocBps)}
          </span>
        )}
      </div>
    </Link>
  );
}
