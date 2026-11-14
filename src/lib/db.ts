import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type PitStatus = "live" | "settled";

export interface PitRow {
  id: string;
  creator: string;
  market: string;
  pool: string;
  margin_bank: string;
  base_decimals: number;
  tick_size: string;
  lot_size: string;
  min_quantity: string;
  side: "long" | "short";
  duration_min: number;
  cap_usd: number;
  thesis: string;
  intent_json: string;
  signature: string;
  open_tx: string;
  start_block: number;
  start_mark: string;
  start_ts: number;
  end_ts: number;
  status: PitStatus;
  end_block: number | null;
  end_mark: string | null;
  settled_ts: number | null;
  winner: string | null;
  parent_id: string | null;
}

export interface JoinRow {
  id: number;
  pit_id: string;
  wallet: string;
  side: "long" | "short";
  qty: string;
  entry: string;
  notional: string;
  tx_hash: string;
  block_number: number;
  ts: number;
  close_tx: string | null;
  final_pnl: string | null;
  final_roc_bps: number | null;
}

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  const file = process.env.OPENPIT_DB ?? path.join(process.cwd(), "data", "openpit.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pits (
      id TEXT PRIMARY KEY, creator TEXT NOT NULL, market TEXT NOT NULL, pool TEXT NOT NULL, margin_bank TEXT NOT NULL,
      base_decimals INTEGER NOT NULL, tick_size TEXT NOT NULL, lot_size TEXT NOT NULL, min_quantity TEXT NOT NULL,
      side TEXT NOT NULL, duration_min INTEGER NOT NULL, cap_usd REAL NOT NULL, thesis TEXT NOT NULL DEFAULT '',
      intent_json TEXT NOT NULL, signature TEXT NOT NULL, open_tx TEXT NOT NULL UNIQUE,
      start_block INTEGER NOT NULL, start_mark TEXT NOT NULL, start_ts INTEGER NOT NULL, end_ts INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'live', end_block INTEGER, end_mark TEXT, settled_ts INTEGER, winner TEXT, parent_id TEXT
    );
    CREATE TABLE IF NOT EXISTS joins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, pit_id TEXT NOT NULL REFERENCES pits(id), wallet TEXT NOT NULL, side TEXT NOT NULL,
      qty TEXT NOT NULL, entry TEXT NOT NULL, notional TEXT NOT NULL, tx_hash TEXT NOT NULL UNIQUE, block_number INTEGER NOT NULL,
      ts INTEGER NOT NULL, close_tx TEXT, final_pnl TEXT, final_roc_bps REAL
    );
    CREATE INDEX IF NOT EXISTS joins_pit ON joins(pit_id);
    CREATE INDEX IF NOT EXISTS pits_status ON pits(status, end_ts);
  `);
  return db;
}

export const q = {
  insertPit(p: Omit<PitRow, "status" | "end_block" | "end_mark" | "settled_ts" | "winner">) {
    getDb()
      .prepare(
        `INSERT INTO pits (id, creator, market, pool, margin_bank, base_decimals, tick_size, lot_size, min_quantity, side, duration_min, cap_usd, thesis, intent_json, signature, open_tx, start_block, start_mark, start_ts, end_ts, parent_id)
         VALUES (@id, @creator, @market, @pool, @margin_bank, @base_decimals, @tick_size, @lot_size, @min_quantity, @side, @duration_min, @cap_usd, @thesis, @intent_json, @signature, @open_tx, @start_block, @start_mark, @start_ts, @end_ts, @parent_id)`,
      )
      .run(p);
  },
  getPit(id: string) {
    return getDb().prepare("SELECT * FROM pits WHERE id = ?").get(id) as PitRow | undefined;
  },
  pitByTx(tx: string) {
    return getDb().prepare("SELECT * FROM pits WHERE open_tx = ?").get(tx) as PitRow | undefined;
  },
  livePits() {
    return getDb().prepare("SELECT * FROM pits WHERE status = 'live' ORDER BY end_ts ASC").all() as PitRow[];
  },
  settledPits(limit = 12) {
    return getDb().prepare("SELECT * FROM pits WHERE status = 'settled' ORDER BY settled_ts DESC LIMIT ?").all(limit) as PitRow[];
  },
  joins(pitId: string) {
    return getDb().prepare("SELECT * FROM joins WHERE pit_id = ? ORDER BY id ASC").all(pitId) as JoinRow[];
  },
  joinByTx(tx: string) {
    return getDb().prepare("SELECT * FROM joins WHERE tx_hash = ?").get(tx) as JoinRow | undefined;
  },
  insertJoin(j: Omit<JoinRow, "id" | "close_tx" | "final_pnl" | "final_roc_bps">) {
    getDb()
      .prepare(
        `INSERT INTO joins (pit_id, wallet, side, qty, entry, notional, tx_hash, block_number, ts)
         VALUES (@pit_id, @wallet, @side, @qty, @entry, @notional, @tx_hash, @block_number, @ts)`,
      )
      .run(j);
  },
  settlePit(id: string, endBlock: number, endMark: string, winner: string | null, results: { id: number; pnl: string; roc: number }[]) {
    const d = getDb();
    const tx = d.transaction(() => {
      d.prepare("UPDATE pits SET status='settled', end_block=?, end_mark=?, settled_ts=?, winner=? WHERE id=? AND status='live'").run(
        endBlock, endMark, Math.floor(Date.now() / 1000), winner, id,
      );
      const u = d.prepare("UPDATE joins SET final_pnl=?, final_roc_bps=? WHERE id=?");
      for (const r of results) u.run(r.pnl, r.roc, r.id);
    });
    tx();
  },
  setCloseTx(joinId: number, tx: string) {
    getDb().prepare("UPDATE joins SET close_tx=? WHERE id=?").run(tx, joinId);
  },
  leaderboard(limit = 10) {
    return getDb()
      .prepare(
        `SELECT j.wallet, j.side, j.final_roc_bps, j.final_pnl, p.market, p.id AS pit_id, p.cap_usd
         FROM joins j JOIN pits p ON p.id = j.pit_id
         WHERE p.status = 'settled' AND j.final_roc_bps IS NOT NULL
         ORDER BY j.final_roc_bps DESC LIMIT ?`,
      )
      .all(limit) as { wallet: string; side: string; final_roc_bps: number; final_pnl: string; market: string; pit_id: string; cap_usd: number }[];
  },
};
