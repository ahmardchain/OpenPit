import type { Address } from "viem";
import { INDEXER_URL, PIT_MARKETS } from "./chain";
import { readMark } from "./server-chain";

export interface MarketRow {
  symbol: string;
  pool: Address;
  marginBank: Address;
  baseDecimals: number;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  markPrice: string | null;
}

const QUERY = `query Perps($symbols: [String!]) {
  Market(where: { marketType: { _eq: "PERP" }, baseSymbol: { _in: $symbols } }) {
    id baseSymbol baseDecimals tickSize lotSize minQuantity marginBank
  }
}`;

/** Perp markets OpenPit offers, from the dreamDEX indexer, each with its live mark read from chain. */
export async function fetchMarkets(symbols: readonly string[] = PIT_MARKETS): Promise<MarketRow[]> {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { symbols } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`dreamDEX indexer returned ${res.status}`);
  const json = (await res.json()) as { data?: { Market: Record<string, string | number>[] } };
  if (!json.data) throw new Error("dreamDEX indexer returned no data");
  const rows = await Promise.all(
    json.data.Market.map(async (m) => {
      const mark = await readMark(m.id as Address).catch(() => ({ ok: false, price: 0n }));
      return {
        symbol: String(m.baseSymbol),
        pool: m.id as Address,
        marginBank: m.marginBank as Address,
        baseDecimals: Number(m.baseDecimals),
        tickSize: String(m.tickSize),
        lotSize: String(m.lotSize),
        minQuantity: String(m.minQuantity),
        markPrice: mark.ok ? mark.price.toString() : null,
      };
    }),
  );
  return rows.sort((a, b) => PIT_MARKETS.indexOf(a.symbol as never) - PIT_MARKETS.indexOf(b.symbol as never));
}

/** Player names for paper play: 2–20 letters, digits, dot, dash or underscore. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return /^[A-Za-z0-9_.-]{2,20}$/.test(name) && !/^0x[0-9a-fA-F]{4,}/.test(name) ? name : null;
}

export const capRaw = (capUsd: number) => BigInt(Math.round(capUsd * 1e6)) * 10n ** 12n;
