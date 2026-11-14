import { NextResponse } from "next/server";
import type { Address, Hash, Hex } from "viem";
import { q } from "@/lib/db";
import { verifyIntent, type PitIntent } from "@/lib/intent";
import { loadPit, toView, withJoins } from "@/lib/pit-view";
import { serverClient, verifyOrderTx } from "@/lib/server-chain";
import { CHAIN_ID } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET() {
  const [live, settled, leaderboard] = await Promise.all([q.livePits().then(withJoins), q.settledPits().then(withJoins), q.leaderboard()]);
  return NextResponse.json({ live, settled, leaderboard });
}

interface CreateBody {
  intent: PitIntent;
  signature: Hex;
  openTx: Hash;
  market: { marginBank: Address; baseDecimals: number; tickSize: string; lotSize: string; minQuantity: string };
  parentId?: string;
}

/** Create a pit. The creator must already have a confirmed opening order; we verify the tx on-chain before the pit goes live. */
export async function POST(req: Request) {
  const body = (await req.json()) as CreateBody;
  const { intent, signature, openTx, market } = body;
  if (!intent || !signature || !openTx || !market) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  if (intent.chainId !== CHAIN_ID) return NextResponse.json({ error: "wrong chain in intent" }, { status: 400 });
  if (![5, 15, 30].includes(intent.durationMin)) return NextResponse.json({ error: "duration must be 5, 15 or 30 min" }, { status: 400 });
  if (!(intent.capUsd >= 1 && intent.capUsd <= 100_000)) return NextResponse.json({ error: "cap must be 1–100000 USDso" }, { status: 400 });
  if (intent.thesis.length > 140) return NextResponse.json({ error: "thesis max 140 chars" }, { status: 400 });
  if (!(await verifyIntent(intent, signature))) return NextResponse.json({ error: "intent signature does not verify" }, { status: 400 });
  if (await q.pitByTx(openTx)) return NextResponse.json({ error: "that opening tx already backs a pit" }, { status: 409 });

  let v;
  try {
    v = await verifyOrderTx(openTx, intent.creator, intent.pool, market.marginBank);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (v.filledQty === 0n) return NextResponse.json({ error: "opening order did not fill; the pit needs a real position" }, { status: 400 });
  if (v.newSize !== null && (intent.side === "long" ? v.newSize <= 0n : v.newSize >= 0n))
    return NextResponse.json({ error: "opening order direction does not match the declared side" }, { status: 400 });

  const block = await serverClient.getBlock({ blockNumber: BigInt(v.blockNumber) });
  const startTs = Number(block.timestamp);
  const id = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("");
  const capRaw = BigInt(Math.round(intent.capUsd * 1e6)) * 10n ** 12n;
  const qty = v.filledQty;
  const entry = v.avgFill;
  const notional = (qty * entry) / 10n ** BigInt(market.baseDecimals);

  await q.insertPit({
    id,
    creator: intent.creator,
    market: intent.market,
    pool: intent.pool,
    margin_bank: market.marginBank,
    base_decimals: market.baseDecimals,
    tick_size: market.tickSize,
    lot_size: market.lotSize,
    min_quantity: market.minQuantity,
    side: intent.side,
    duration_min: intent.durationMin,
    cap_usd: intent.capUsd,
    thesis: intent.thesis,
    intent_json: JSON.stringify(intent),
    signature,
    open_tx: openTx,
    start_block: v.blockNumber,
    start_mark: (v.markAtBlock || entry).toString(),
    start_ts: startTs,
    end_ts: startTs + intent.durationMin * 60,
    parent_id: body.parentId ?? null,
  });
  // The creator is the first participant.
  await q.insertJoin({
    pit_id: id,
    wallet: intent.creator,
    side: intent.side,
    qty: qty.toString(),
    entry: entry.toString(),
    notional: notional.toString(),
    tx_hash: openTx,
    block_number: v.blockNumber,
    ts: startTs,
  });
  void capRaw;
  return NextResponse.json({ id, pit: await loadPit(id) });
}
