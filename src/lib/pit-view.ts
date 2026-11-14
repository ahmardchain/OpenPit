import type { JoinRow, PitRow } from "./db";

/** JSON-safe shape sent to the browser. */
export interface PitView {
  id: string;
  creator: string;
  market: string;
  pool: `0x${string}`;
  marginBank: `0x${string}`;
  baseDecimals: number;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  side: "long" | "short";
  durationMin: number;
  capUsd: number;
  thesis: string;
  intent: unknown;
  signature: string;
  openTx: string;
  startBlock: number;
  startMark: string;
  startTs: number;
  endTs: number;
  status: "live" | "settled";
  endBlock: number | null;
  endMark: string | null;
  settledTs: number | null;
  winner: string | null;
  parentId: string | null;
  joins: JoinView[];
}

export interface JoinView {
  id: number;
  wallet: string;
  side: "long" | "short";
  qty: string;
  entry: string;
  notional: string;
  txHash: string;
  blockNumber: number;
  ts: number;
  closeTx: string | null;
  finalPnl: string | null;
  finalRocBps: number | null;
}

export function toView(p: PitRow, joins: JoinRow[]): PitView {
  return {
    id: p.id,
    creator: p.creator,
    market: p.market,
    pool: p.pool as `0x${string}`,
    marginBank: p.margin_bank as `0x${string}`,
    baseDecimals: p.base_decimals,
    tickSize: p.tick_size,
    lotSize: p.lot_size,
    minQuantity: p.min_quantity,
    side: p.side,
    durationMin: p.duration_min,
    capUsd: p.cap_usd,
    thesis: p.thesis,
    intent: JSON.parse(p.intent_json),
    signature: p.signature,
    openTx: p.open_tx,
    startBlock: p.start_block,
    startMark: p.start_mark,
    startTs: p.start_ts,
    endTs: p.end_ts,
    status: p.status,
    endBlock: p.end_block,
    endMark: p.end_mark,
    settledTs: p.settled_ts,
    winner: p.winner,
    parentId: p.parent_id,
    joins: joins.map((j) => ({
      id: j.id,
      wallet: j.wallet,
      side: j.side,
      qty: j.qty,
      entry: j.entry,
      notional: j.notional,
      txHash: j.tx_hash,
      blockNumber: j.block_number,
      ts: j.ts,
      closeTx: j.close_tx,
      finalPnl: j.final_pnl,
      finalRocBps: j.final_roc_bps,
    })),
  };
}
