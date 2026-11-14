/**
 * End-to-end run against a running OpenPit server (default http://localhost:3000):
 *   wallet 1 signs an intent + places the opening order → pit goes live
 *   wallet 2 FADES with a real order → join is verified server-side
 *   wait for the bell → settle → both close with reduce-only IOCs
 * Every tx hash is appended to EVIDENCE.md with explorer links.
 *
 *   npm run e2e            (uses SMOKE_PRIVATE_KEY / SMOKE_PRIVATE_KEY_2 from .env)
 *   E2E_DURATION=5 E2E_CAP=20 E2E_MARKET=BTC npm run e2e
 */
import "dotenv/config";
import { appendFileSync } from "node:fs";
import { formatUnits, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ORDER_TYPE, SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const APP = process.env.E2E_APP ?? "http://localhost:3000";
const INDEXER = "https://hideki-dev.smk.somnia.host/v1/graphql";
const EXPLORER = "https://explorer.testnet.somnia.network/tokyo";
const MARKET = process.env.E2E_MARKET ?? "BTC";
const DURATION = Number(process.env.E2E_DURATION ?? 5);
const CAP = Number(process.env.E2E_CAP ?? 20);
const k1 = process.env.SMOKE_PRIVATE_KEY as `0x${string}`;
const k2 = process.env.SMOKE_PRIVATE_KEY_2 as `0x${string}`;
if (!k1 || !k2) throw new Error("SMOKE_PRIVATE_KEY and SMOKE_PRIVATE_KEY_2 required");

const ev: string[] = [];
const log = (s: string) => { console.log(s); ev.push(s); };
const tx = (h: string) => `[${h.slice(0, 10)}…](${EXPLORER}/tx/${h})`;
const mk = (key: `0x${string}`) => new SomniaMarkets({ chain: hidekiTestnet as unknown as Chain, indexerUrl: INDEXER, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, privateKey: key });
const alignTick = (p: bigint, t: bigint, up: boolean) => (p % t === 0n ? p : up ? p - (p % t) + t : p - (p % t));
const alignLot = (q: bigint, l: bigint) => q - (q % l);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${APP}${path}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(`${path}: ${j.error ?? r.status}`);
  return j;
}

interface Market { symbol: string; pool: Address; marginBank: Address; baseDecimals: number; tickSize: string; lotSize: string; minQuantity: string }

async function openFor(m: SomniaMarkets, market: Market, isBid: boolean, capUsd: number) {
  const me = m.walletAddress!;
  const st = await m.client.getPerpState(market.pool);
  const price = alignTick(isBid ? (st.markPrice * 102n) / 100n : (st.markPrice * 98n) / 100n, BigInt(market.tickSize), isBid);
  const max = await m.client.getMaxPerpOrderSize({ pool: market.pool, marginBank: market.marginBank, account: me, isBid, price });
  if (!max.priceable) throw new Error("unpriceable");
  const oneBase = 10n ** BigInt(market.baseDecimals);
  const capRaw = BigInt(Math.round(capUsd * 1e6)) * 10n ** 12n;
  let qty = alignLot((capRaw * oneBase) / st.markPrice, BigInt(market.lotSize));
  if (qty > max.maxQuantity) qty = alignLot(max.maxQuantity, BigInt(market.lotSize));
  if (!max.placeable || qty < BigInt(market.minQuantity)) throw new Error(`not placeable: ${max.placeable ? "below minQuantity" : max.limitedBy}`);
  const r = await m.trader.placePerpOrder({ pool: market.pool, isBid, price, quantity: qty, orderType: ORDER_TYPE.MARKET, gas: 10_000_000n });
  return { hash: r.hash, qty, fills: r.fills.length };
}

async function closeAll(m: SomniaMarkets, market: Market) {
  const me = m.walletAddress!;
  const pos = await m.client.getPerpPosition({ marginBank: market.marginBank, account: me, pool: market.pool });
  if (pos.size === 0n) return null;
  const isBid = pos.size < 0n;
  const st = await m.client.getPerpState(market.pool);
  const price = alignTick(isBid ? (st.markPrice * 102n) / 100n : (st.markPrice * 98n) / 100n, BigInt(market.tickSize), isBid);
  const qty = alignLot(pos.size < 0n ? -pos.size : pos.size, BigInt(market.lotSize));
  const r = await m.trader.placePerpOrder({ pool: market.pool, isBid, price, quantity: qty, orderType: ORDER_TYPE.MARKET, gas: 10_000_000n });
  return r.hash;
}

async function ensureMargin(m: SomniaMarkets, market: Market) {
  const me = m.walletAddress!;
  const el = await m.client.getPerpVoucherEligibility(market.marginBank, me);
  if (el.eligible) {
    try {
      const r = await m.trader.claimPerpVoucher({ marginBank: market.marginBank });
      log(`- ${me} claimed paper USDso: ${tx(r.hash)}`);
    } catch (e: any) {
      log(`- ${me} voucher claim reverted (${(e?.shortMessage ?? e?.message ?? "").slice(0, 60)}); using wallet USDso`);
    }
  }
  const pre = await m.client.getMarginAccount(market.marginBank, me);
  const quote = (await m.client.listPerpMarkets({ baseSymbol: market.symbol }))[0].quoteToken as Address;
  const walletUsd = await m.client.getErc20Balance(quote, me);
  if (pre.equity <= 0n && walletUsd > 0n) {
    const d = await m.trader.depositMargin({ marginBank: market.marginBank, amount: walletUsd, collateral: quote, autoApprove: true });
    log(`- ${me} deposited ${formatUnits(walletUsd, 18)} USDso into MarginBank: ${tx(d.hash)}`);
  }
  const acct = await m.client.getMarginAccount(market.marginBank, me);
  log(`- ${me} perps equity ${formatUnits(acct.equity, 18)} USDso, STT ${formatUnits(await m.client.getNativeBalance(me), 18)}`);
  if (acct.equity <= 0n) throw new Error(`${me} has no margin — fund it (Telegram /faucet) first`);
}

async function main() {
  const a1 = privateKeyToAccount(k1), a2 = privateKeyToAccount(k2);
  log(`\n## End-to-end pit run ${new Date().toISOString()}`);
  log(`- creator ${a1.address} · joiner ${a2.address} · market ${MARKET} · ${DURATION} min · cap ${CAP} USDso`);
  const { markets } = await api<{ markets: Market[] }>("/api/markets");
  const market = markets.find((x) => x.symbol === MARKET)!;
  const m1 = mk(k1), m2 = mk(k2);
  await ensureMargin(m1, market);
  await ensureMargin(m2, market);

  // 1. Creator: sign intent, open, register.
  const side = "long" as const;
  const intent = { app: "OpenPit" as const, chainId: 50383, market: market.symbol, pool: market.pool, side, durationMin: DURATION, capUsd: CAP, thesis: "e2e: the crowd is about to fade me", creator: a1.address, nonce: crypto.randomUUID() };
  const { intentMessage } = await import("../src/lib/intent");
  const signature = await a1.signMessage({ message: intentMessage(intent) });
  const open = await openFor(m1, market, true, CAP);
  log(`- creator opening LONG order (${open.fills} fills, qty ${formatUnits(open.qty, market.baseDecimals)}): ${tx(open.hash)}`);
  const created = await api<{ id: string }>("/api/pits", { intent, signature, openTx: open.hash, market });
  log(`- pit created: ${APP}/pit/${created.id} (intent EIP-191 signature ${signature.slice(0, 12)}…)`);

  // 2. Joiner fades.
  const fade = await openFor(m2, market, false, CAP);
  log(`- joiner FADE (short) order (${fade.fills} fills, qty ${formatUnits(fade.qty, market.baseDecimals)}): ${tx(fade.hash)}`);
  await api(`/api/pits/${created.id}/join`, { wallet: a2.address, side: "short", txHash: fade.hash });
  log(`- join verified server-side via RPC receipt and recorded`);

  // 3. Wait for the bell.
  const pit = (await api<{ pit: { endTs: number } }>(`/api/pits/${created.id}`)).pit;
  const wait = pit.endTs * 1000 - Date.now() + 1500;
  log(`- waiting ${Math.ceil(wait / 1000)}s for the bell…`);
  if (wait > 0) await sleep(wait);
  let settled: { pit: { status: string; endBlock: number; endMark: string; winner: string; joins: { wallet: string; side: string; finalPnl: string; finalRocBps: number }[] } } | null = null;
  for (let i = 0; i < 20 && !settled; i++) {
    try { settled = await api(`/api/pits/${created.id}/settle`, {}); } catch { await sleep(3000); }
  }
  if (!settled) throw new Error("settle failed");
  log(`- settled at block ${settled.pit.endBlock}, frozen mark ${formatUnits(BigInt(settled.pit.endMark), 18)}; winner ${settled.pit.winner}`);
  for (const j of settled.pit.joins) log(`  - ${j.wallet} ${j.side}: pnl ${formatUnits(BigInt(j.finalPnl), 18)} USDso, return-on-cap ${(j.finalRocBps / 100).toFixed(3)}%`);
  log(`- OG card: ${APP}/api/og/${created.id}`);

  // 4. Close positions (reduce-only IOCs) and record.
  const c1 = await closeAll(m1, market);
  if (c1) log(`- creator close: ${tx(c1)}`);
  const c2 = await closeAll(m2, market);
  if (c2) log(`- joiner close: ${tx(c2)}`);
  const joins = (await api<{ pit: { joins: { id: number; wallet: string; side: string }[] } }>(`/api/pits/${created.id}`)).pit.joins;
  for (const [addr, hash] of [[a1.address, c1], [a2.address, c2]] as const) {
    const j = joins.find((x) => x.wallet.toLowerCase() === addr.toLowerCase());
    if (j && hash) await api(`/api/pits/${created.id}/join`, { wallet: addr, side: j.side, txHash: hash, closeOf: j.id }).catch((e) => log(`  (close record failed: ${e.message})`));
  }
  log(`- done ✅`);
}

main()
  .catch((e) => { log(`- FAILED: ${e?.shortMessage ?? e?.message ?? e}`); process.exitCode = 1; })
  .finally(() => { appendFileSync("EVIDENCE.md", ev.join("\n") + "\n"); process.exit(); });
