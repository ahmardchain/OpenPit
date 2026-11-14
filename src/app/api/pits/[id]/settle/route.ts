import { NextResponse } from "next/server";
import type { Address } from "viem";
import { q } from "@/lib/db";
import { toView } from "@/lib/pit-view";
import { headBlock, readMark, serverClient } from "@/lib/server-chain";
import { returnOnCapBps, sessionPnl } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/**
 * The bell. Anyone may call it once end_ts has passed; the first call wins and is idempotent after.
 * We find the first block at/after end_ts (walking back from head), freeze its mark, and score every join:
 * return-on-cap = sessionPnl(join size, entry → frozen mark) / cap. Same denominator for everyone, so size doesn't win.
 */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pit = q.getPit(id);
  if (!pit) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (pit.status === "settled") return NextResponse.json({ pit: toView(pit, q.joins(id)) });

  const head = await headBlock();
  const headBlk = await serverClient.getBlock({ blockNumber: head });
  if (Number(headBlk.timestamp) < pit.end_ts) return NextResponse.json({ error: "the bell has not rung yet" }, { status: 409 });

  // Walk back to the earliest block whose timestamp >= end_ts (Hideki blocks are sub-second; bound the walk).
  let endBlock = head;
  for (let i = 0; i < 400; i++) {
    const prev = await serverClient.getBlock({ blockNumber: endBlock - 1n });
    if (Number(prev.timestamp) < pit.end_ts) break;
    endBlock = endBlock - 1n;
  }
  let mark = await readMark(pit.pool as Address, endBlock);
  if (!mark.ok) mark = await readMark(pit.pool as Address); // stale at that exact block: fall back to head, still recorded
  if (!mark.ok) return NextResponse.json({ error: "mark price unavailable; try again shortly" }, { status: 503 });

  const capRaw = BigInt(Math.round(pit.cap_usd * 1e6)) * 10n ** 12n;
  const joins = q.joins(id);
  const results = joins.map((j) => {
    const pnl = sessionPnl(j.side, BigInt(j.qty), BigInt(j.entry), mark.price, pit.base_decimals);
    return { id: j.id, wallet: j.wallet, pnl: pnl.toString(), roc: returnOnCapBps(pnl, capRaw) };
  });
  const winner = results.length ? results.reduce((a, b) => (b.roc > a.roc ? b : a)).wallet : null;
  q.settlePit(id, Number(endBlock), mark.price.toString(), winner, results);
  return NextResponse.json({ pit: toView(q.getPit(id)!, q.joins(id)) });
}
