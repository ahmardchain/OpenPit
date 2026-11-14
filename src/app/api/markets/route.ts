import { NextResponse } from "next/server";
import { PIT_MARKETS } from "@/lib/chain";
import { INDEXER_URL } from "@/lib/chain";
import { readMark } from "@/lib/server-chain";

export const dynamic = "force-dynamic";

const QUERY = `query Perps($symbols: [String!]) {
  Market(where: { marketType: { _eq: "PERP" }, baseSymbol: { _in: $symbols } }) {
    id baseSymbol baseDecimals quoteDecimals tickSize lotSize minQuantity marginBank markPrice
  }
}`;

/** Perp markets OpenPit offers, read from the dreamDEX indexer with the live mark from chain. No cached or hardcoded rows. */
export async function GET() {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { symbols: PIT_MARKETS } }),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `indexer ${res.status}` }, { status: 502 });
  const json = (await res.json()) as { data?: { Market: Record<string, string | number>[] }; errors?: unknown };
  if (!json.data) return NextResponse.json({ error: "indexer error", detail: json.errors }, { status: 502 });

  const rows = await Promise.all(
    json.data.Market.map(async (m) => {
      const mark = await readMark(m.id as `0x${string}`).catch(() => ({ ok: false, price: 0n }));
      return {
        symbol: m.baseSymbol as string,
        pool: m.id as `0x${string}`,
        marginBank: m.marginBank as `0x${string}`,
        baseDecimals: Number(m.baseDecimals),
        tickSize: String(m.tickSize),
        lotSize: String(m.lotSize),
        minQuantity: String(m.minQuantity),
        markPrice: mark.ok ? mark.price.toString() : null,
      };
    }),
  );
  rows.sort((a, b) => PIT_MARKETS.indexOf(a.symbol as never) - PIT_MARKETS.indexOf(b.symbol as never));
  return NextResponse.json({ markets: rows });
}
