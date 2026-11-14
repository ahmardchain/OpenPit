/**
 * Pit metadata store on Cloudflare D1 (SQLite). The same binding serves `next dev` (local miniflare D1 via
 * initOpenNextCloudflareForDev) and production Workers. Schema lives in migrations/0001_init.sql.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

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

// Mirrors migrations/0001_init.sql. Run once per isolate so a freshly created database needs no manual migration.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pits (
    id TEXT PRIMARY KEY, creator TEXT NOT NULL, market TEXT NOT NULL, pool TEXT NOT NULL, margin_bank TEXT NOT NULL,
    base_decimals INTEGER NOT NULL, tick_size TEXT NOT NULL, lot_size TEXT NOT NULL, min_quantity TEXT NOT NULL,
    side TEXT NOT NULL, duration_min INTEGER NOT NULL, cap_usd REAL NOT NULL, thesis TEXT NOT NULL DEFAULT '',
    intent_json TEXT NOT NULL, signature TEXT NOT NULL, open_tx TEXT NOT NULL UNIQUE,
    start_block INTEGER NOT NULL, start_mark TEXT NOT NULL, start_ts INTEGER NOT NULL, end_ts INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'live', end_block INTEGER, end_mark TEXT, settled_ts INTEGER, winner TEXT, parent_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS joins (
    id INTEGER PRIMARY KEY AUTOINCREMENT, pit_id TEXT NOT NULL REFERENCES pits(id), wallet TEXT NOT NULL, side TEXT NOT NULL,
    qty TEXT NOT NULL, entry TEXT NOT NULL, notional TEXT NOT NULL, tx_hash TEXT NOT NULL UNIQUE, block_number INTEGER NOT NULL,
    ts INTEGER NOT NULL, close_tx TEXT, final_pnl TEXT, final_roc_bps REAL
  )`,
  `CREATE INDEX IF NOT EXISTS joins_pit ON joins(pit_id)`,
  `CREATE INDEX IF NOT EXISTS pits_status ON pits(status, end_ts)`,
];
let schemaReady: Promise<unknown> | null = null;

async function db(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const d1 = (env as { DB?: D1Database }).DB;
  if (!d1) throw new Error("D1 binding `DB` is missing — check the d1_databases entry in wrangler.jsonc.");
  schemaReady ??= d1.batch(SCHEMA.map((s) => d1.prepare(s))).catch((e) => {
    schemaReady = null;
    throw e;
  });
  await schemaReady;
  return d1;
}

export const q = {
  async insertPit(p: Omit<PitRow, "status" | "end_block" | "end_mark" | "settled_ts" | "winner">) {
    const d = await db();
    await d
      .prepare(
        `INSERT INTO pits (id, creator, market, pool, margin_bank, base_decimals, tick_size, lot_size, min_quantity, side, duration_min, cap_usd, thesis, intent_json, signature, open_tx, start_block, start_mark, start_ts, end_ts, parent_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`,
      )
      .bind(p.id, p.creator, p.market, p.pool, p.margin_bank, p.base_decimals, p.tick_size, p.lot_size, p.min_quantity, p.side, p.duration_min, p.cap_usd, p.thesis, p.intent_json, p.signature, p.open_tx, p.start_block, p.start_mark, p.start_ts, p.end_ts, p.parent_id)
      .run();
  },
  async getPit(id: string) {
    return (await (await db()).prepare("SELECT * FROM pits WHERE id = ?1").bind(id).first<PitRow>()) ?? undefined;
  },
  async pitByTx(tx: string) {
    return (await (await db()).prepare("SELECT * FROM pits WHERE open_tx = ?1").bind(tx).first<PitRow>()) ?? undefined;
  },
  async livePits() {
    return (await (await db()).prepare("SELECT * FROM pits WHERE status = 'live' ORDER BY end_ts ASC").all<PitRow>()).results;
  },
  async settledPits(limit = 12) {
    return (await (await db()).prepare("SELECT * FROM pits WHERE status = 'settled' ORDER BY settled_ts DESC LIMIT ?1").bind(limit).all<PitRow>()).results;
  },
  async joins(pitId: string) {
    return (await (await db()).prepare("SELECT * FROM joins WHERE pit_id = ?1 ORDER BY id ASC").bind(pitId).all<JoinRow>()).results;
  },
  async joinByTx(tx: string) {
    return (await (await db()).prepare("SELECT * FROM joins WHERE tx_hash = ?1").bind(tx).first<JoinRow>()) ?? undefined;
  },
  async insertJoin(j: Omit<JoinRow, "id" | "close_tx" | "final_pnl" | "final_roc_bps">) {
    await (await db())
      .prepare(`INSERT INTO joins (pit_id, wallet, side, qty, entry, notional, tx_hash, block_number, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(j.pit_id, j.wallet, j.side, j.qty, j.entry, j.notional, j.tx_hash, j.block_number, j.ts)
      .run();
  },
  async settlePit(id: string, endBlock: number, endMark: string, winner: string | null, results: { id: number; pnl: string; roc: number }[]) {
    const d = await db();
    const stmts = [
      d.prepare("UPDATE pits SET status='settled', end_block=?1, end_mark=?2, settled_ts=?3, winner=?4 WHERE id=?5 AND status='live'").bind(endBlock, endMark, Math.floor(Date.now() / 1000), winner, id),
      ...results.map((r) => d.prepare("UPDATE joins SET final_pnl=?1, final_roc_bps=?2 WHERE id=?3").bind(r.pnl, r.roc, r.id)),
    ];
    await d.batch(stmts);
  },
  async setCloseTx(joinId: number, tx: string) {
    await (await db()).prepare("UPDATE joins SET close_tx=?1 WHERE id=?2").bind(tx, joinId).run();
  },
  async leaderboard(limit = 10) {
    return (
      await (await db())
        .prepare(
          `SELECT j.wallet, j.side, j.final_roc_bps, j.final_pnl, p.market, p.id AS pit_id, p.cap_usd
           FROM joins j JOIN pits p ON p.id = j.pit_id
           WHERE p.status = 'settled' AND j.final_roc_bps IS NOT NULL
           ORDER BY j.final_roc_bps DESC LIMIT ?1`,
        )
        .bind(limit)
        .all<{ wallet: string; side: string; final_roc_bps: number; final_pnl: string; market: string; pit_id: string; cap_usd: number }>()
    ).results;
  },
};
