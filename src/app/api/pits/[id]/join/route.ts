import { NextResponse } from "next/server";
import type { Address, Hash } from "viem";
import { q } from "@/lib/db";
import { loadPit } from "@/lib/pit-view";
import { readMark, serverClient, verifyOrderTx } from "@/lib/server-chain";
import { capRaw as toCapRaw, cleanName } from "@/lib/markets-server";

export const dynamic = "force-dynamic";

/**
 * Record a join after the wallet's order confirmed. We never trust the body's numbers:
 * the fill quantity, VWAP and sender are re-derived from the receipt over RPC.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pit = await q.getPit(id);
  if (!pit) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as { mode?: "demo"; name?: string; wallet: Address; side: "long" | "short"; txHash: Hash; closeOf?: number };

  // Paper join: no wallet. The position opens at the live on-chain mark at the current head block.
  if (body.mode === "demo") {
    const name = cleanName(body.name);
    if (!name) return NextResponse.json({ error: "Pick a name of 2 to 20 letters, digits, dots, dashes or underscores." }, { status: 400 });
    if (pit.status !== "live" || Date.now() / 1000 >= pit.end_ts) return NextResponse.json({ error: "The bell has rung. This pit is closed to new players." }, { status: 409 });
    if (body.side !== "long" && body.side !== "short") return NextResponse.json({ error: "Choose long or short." }, { status: 400 });
    if (await q.joinByPlayer(id, name)) return NextResponse.json({ error: `${name} is already in this pit. Pick another name.` }, { status: 409 });
    const head = await serverClient.getBlock();
    const mark = await readMark(pit.pool as Address, head.number);
    if (!mark.ok) return NextResponse.json({ error: "The mark price is stale right now. Try again in a few seconds." }, { status: 503 });
    const oneBase = 10n ** BigInt(pit.base_decimals);
    const qty = (toCapRaw(pit.cap_usd) * oneBase) / mark.price;
    await q.insertJoin({
      pit_id: id,
      mode: "demo",
      wallet: name,
      side: body.side,
      qty: qty.toString(),
      entry: mark.price.toString(),
      notional: ((qty * mark.price) / oneBase).toString(),
      tx_hash: null,
      block_number: Number(head.number),
      ts: Number(head.timestamp),
    });
    return NextResponse.json({ pit: await loadPit(id) });
  }

  const { wallet, side, txHash, closeOf } = body;
  if (!wallet || !txHash) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  // A "close" is a reduce order recorded against an existing join (after the bell).
  if (closeOf) {
    const j = (await q.joins(id)).find((x) => x.id === closeOf && x.wallet.toLowerCase() === wallet.toLowerCase());
    if (!j) return NextResponse.json({ error: "join not found" }, { status: 404 });
    try {
      await verifyOrderTx(txHash, wallet, pit.pool as Address, pit.margin_bank as Address);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    await q.setCloseTx(j.id, txHash);
    return NextResponse.json({ pit: await loadPit(id) });
  }

  if (pit.status !== "live" || Date.now() / 1000 >= pit.end_ts) return NextResponse.json({ error: "the bell has rung — this pit is closed to new joins" }, { status: 409 });
  if (side !== "long" && side !== "short") return NextResponse.json({ error: "side must be long or short" }, { status: 400 });
  if (await q.joinByTx(txHash)) return NextResponse.json({ error: "that tx is already recorded" }, { status: 409 });

  let v;
  try {
    v = await verifyOrderTx(txHash, wallet, pit.pool as Address, pit.margin_bank as Address);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (v.blockNumber < pit.start_block) return NextResponse.json({ error: "order predates the pit" }, { status: 400 });
  if (v.filledQty === 0n) return NextResponse.json({ error: "order did not fill (IOC no-fill) — nothing to score" }, { status: 400 });
  if (v.newSize !== null && (side === "long" ? v.newSize < 0n : v.newSize > 0n))
    return NextResponse.json({ error: "resulting position does not match the chosen side" }, { status: 400 });

  // Clamp scoring to the cap: joins above cap still count, but only cap-worth of notional scores.
  const capRaw = BigInt(Math.round(pit.cap_usd * 1e6)) * 10n ** 12n;
  const oneBase = 10n ** BigInt(pit.base_decimals);
  let qty = v.filledQty;
  let notional = (qty * v.avgFill) / oneBase;
  if (notional > capRaw && v.avgFill > 0n) {
    qty = (capRaw * oneBase) / v.avgFill;
    notional = (qty * v.avgFill) / oneBase;
  }
  const block = await serverClient.getBlock({ blockNumber: BigInt(v.blockNumber) });

  await q.insertJoin({
    pit_id: id,
    mode: "chain",
    wallet,
    side,
    qty: qty.toString(),
    entry: v.avgFill.toString(),
    notional: notional.toString(),
    tx_hash: txHash,
    block_number: v.blockNumber,
    ts: Number(block.timestamp),
  });
  return NextResponse.json({ pit: await loadPit(id) });
}
