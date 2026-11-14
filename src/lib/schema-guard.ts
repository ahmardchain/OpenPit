/**
 * Shape check for the D1 tables. CREATE TABLE IF NOT EXISTS never alters a table that already
 * exists, which is how production kept the pre-paper schema (no `mode`, NOT NULL tx columns)
 * and then 500'd on every read. This module only describes the drift. It does not emit DROP,
 * rebuild, or other destructive SQL.
 */
export interface SchemaColumn {
  name: string;
  /** 1 when the column is NOT NULL. SQLite PRAGMA table_info. */
  notnull: number;
}

export const SCHEMA_VERSION = 2;

export function schemaProblems(pits: SchemaColumn[], joins: SchemaColumn[]): string[] {
  const problems: string[] = [];
  const pitNames = new Set(pits.map((c) => c.name));
  const joinNames = new Set(joins.map((c) => c.name));
  if (!pitNames.has("mode")) problems.push("pits.mode is missing");
  if (!joinNames.has("mode")) problems.push("joins.mode is missing");
  const openTx = pits.find((c) => c.name === "open_tx");
  const txHash = joins.find((c) => c.name === "tx_hash");
  if (!openTx) problems.push("pits.open_tx is missing");
  else if (openTx.notnull) problems.push("pits.open_tx is NOT NULL; paper pits need a null opening tx");
  if (!txHash) problems.push("joins.tx_hash is missing");
  else if (txHash.notnull) problems.push("joins.tx_hash is NOT NULL; paper joins need a null tx hash");
  return problems;
}

export function schemaDriftMessage(problems: string[]): string {
  return (
    `OpenPit D1 schema is out of date (${problems.join("; ")}). ` +
    "CREATE TABLE IF NOT EXISTS does not change an existing table, and OpenPit will not drop or rebuild tables. " +
    "If the tables are empty, drop them yourself so the next request recreates them. " +
    "If they hold rows, add mode (TEXT NOT NULL DEFAULT 'chain') and make open_tx and tx_hash nullable by hand."
  );
}
