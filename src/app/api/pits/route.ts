import { NextResponse } from "next/server";
import type { Address, Hash, Hex } from "viem";
import { q } from "@/lib/db";
import { verifyIntent, type PitIntent } from "@/lib/intent";
import { loadPit, toView, withJoins } from "@/lib/pit-view";
import { readMark, serverClient, verifyOrderTx } from "@/lib/server-chain";
import { CHAIN_ID } from "@/lib/chain";
import { capRaw as toCapRaw, cleanName, fetchMarkets } from "@/lib/markets-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [live, settled, leaderboard] = await Promise.all([q.livePits().then(withJoins), q.settledPits().then(withJoins), q.leaderboard()]);
    return NextResponse.json({ live, settled, leaderboard });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read pits.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateBody {
  intent: PitIntent;
  signature: Hex;
  openTx: Hash;
  market: { marginBank: Address; baseDecimals: number; tickSize: string; lotSize: string; minQuantity: string };
  parentId?: string;
}

interface DemoCreateBody {
  mode: "demo";
  name: string;
  market: string;
  side: "long" | "short";
  durationMin: number;
  capUsd: number;
  thesis?: string;
  parentId?: string;
}

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Paper pit: no wallet. The creator's position opens at the market's live mark, read on-chain at the head block,
 * and settles against the real mark at the bell like any other pit.
 */
async function createDemo(body: DemoCreateBody) {
  const name = cleanName(body.name);
  if (!name) return NextResponse.json({ error: "Pick a name of 2 to 20 letters, digits, dots, dashes or underscores." }, { status: 400 });
  if (body.side !== "long" && body.side !== "short") return NextResponse.json({ error: "Choose long or short." }, { status: 400 });
  if (![5, 15, 30].includes(body.durationMin)) return NextResponse.json({ error: "Duration must be 5, 15 or 30 minutes." }, { status: 400 });
  if (!(body.capUsd >= 1 && body.capUsd <= 100_000)) return NextResponse.json({ error: "Cap must be between 1 and 100,000 USDso." }, { status: 400 });
  const thesis = (body.thesis ?? "").trim().slice(0, 140);
  if ((await q.countLive()) >= 40) return NextResponse.json({ error: "Too many pits are open right now. Join one of them or try again in a few minutes." }, { status: 429 });

  const market = (await fetchMarkets([body.market]))[0];
  if (!market) return NextResponse.json({ error: `No ${body.market} perp market on dreamDEX.` }, { status: 400 });
  const head = await serverClient.getBlock();
  const mark = await readMark(market.pool, head.number);
  if (!mark.ok) return NextResponse.json({ error: `${market.symbol} has no live mark price right now. Try another market.` }, { status: 503 });

  const id = newId();
  const startTs = Number(head.timestamp);
  const oneBase = 10n ** BigInt(market.baseDecimals);
  const cap = toCapRaw(body.capUsd);
  const qty = (cap * oneBase) / mark.price;
  await q.insertPit({
    id,
    mode: "demo",
    creator: name,
    market: market.symbol,
    pool: market.pool,
    margin_bank: market.marginBank,
    base_decimals: market.baseDecimals,
    tick_size: market.tickSize,
    lot_size: market.lotSize,
    min_quantity: market.minQuantity,
    side: body.side,
    duration_min: body.durationMin,
    cap_usd: body.capUsd,
    thesis,
    intent_json: JSON.stringify({ app: "OpenPit", mode: "demo", chainId: CHAIN_ID, market: market.symbol, pool: market.pool, side: body.side, durationMin: body.durationMin, capUsd: body.capUsd, thesis, creator: name }),
    signature: "",
    open_tx: null,
    start_block: Number(head.number),
    start_mark: mark.price.toString(),
    start_ts: startTs,
    end_ts: startTs + body.durationMin * 60,
    parent_id: body.parentId ?? null,
  });
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
    ts: startTs,
  });
  return NextResponse.json({ id, pit: await loadPit(id) });
}

/** Create a pit. Paper pits need only a name; real pits need a confirmed opening order, verified on-chain first. */
export async function POST(req: Request) {
  const raw = (await req.json()) as CreateBody | DemoCreateBody;
  if ((raw as DemoCreateBody).mode === "demo") return createDemo(raw as DemoCreateBody);
  const body = raw as CreateBody;
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
  const id = newId();
  const capRaw = BigInt(Math.round(intent.capUsd * 1e6)) * 10n ** 12n;
  const qty = v.filledQty;
  const entry = v.avgFill;
  const notional = (qty * entry) / 10n ** BigInt(market.baseDecimals);

  await q.insertPit({
    id,
    mode: "chain",
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
    mode: "chain",
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
