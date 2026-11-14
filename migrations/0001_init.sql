-- OpenPit D1 schema (also created at runtime by src/lib/db.ts on first use).
CREATE TABLE IF NOT EXISTS pits (
    id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'chain', creator TEXT NOT NULL, market TEXT NOT NULL, pool TEXT NOT NULL,
    margin_bank TEXT NOT NULL, base_decimals INTEGER NOT NULL, tick_size TEXT NOT NULL, lot_size TEXT NOT NULL, min_quantity TEXT NOT NULL,
    side TEXT NOT NULL, duration_min INTEGER NOT NULL, cap_usd REAL NOT NULL, thesis TEXT NOT NULL DEFAULT '',
    intent_json TEXT NOT NULL, signature TEXT NOT NULL DEFAULT '', open_tx TEXT UNIQUE,
    start_block INTEGER NOT NULL, start_mark TEXT NOT NULL, start_ts INTEGER NOT NULL, end_ts INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'live', end_block INTEGER, end_mark TEXT, settled_ts INTEGER, winner TEXT, parent_id TEXT
  );
CREATE TABLE IF NOT EXISTS joins (
    id INTEGER PRIMARY KEY AUTOINCREMENT, pit_id TEXT NOT NULL REFERENCES pits(id), mode TEXT NOT NULL DEFAULT 'chain',
    wallet TEXT NOT NULL, side TEXT NOT NULL, qty TEXT NOT NULL, entry TEXT NOT NULL, notional TEXT NOT NULL,
    tx_hash TEXT UNIQUE, block_number INTEGER NOT NULL, ts INTEGER NOT NULL,
    close_tx TEXT, final_pnl TEXT, final_roc_bps REAL
  );
CREATE INDEX IF NOT EXISTS joins_pit ON joins(pit_id);
CREATE INDEX IF NOT EXISTS pits_status ON pits(status, end_ts);
