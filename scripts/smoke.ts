/**
 * Step 0 smoke test — proves real on-chain perps orders against dreamDEX (Hideki, chain 50383).
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx --import ./scripts/proxy-preload.mts scripts/smoke.ts
 *   npm run smoke
 *
 * Needs SMOKE_PRIVATE_KEY in .env (never committed). Claims the paper-USDso voucher if eligible,
 * places a tiny IOC on BTC (fallback ETH), then closes it with an opposite IOC. Appends hashes to EVIDENCE.md.
 */
import "dotenv/config";
import { appendFileSync } from "node:fs";
import { formatUnits, parseUnits, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ORDER_TYPE, SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const INDEXER = "https://hideki-dev.smk.somnia.host/v1/graphql";
const EXPLORER = "https://explorer.testnet.somnia.network/tokyo";
const key = process.env.SMOKE_PRIVATE_KEY as `0x${string}` | undefined;
if (!key) throw new Error("SMOKE_PRIVATE_KEY missing in .env");
const me = privateKeyToAccount(key).address;
const j = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v));
const tx = (h: string) => `${EXPLORER}/tx/${h}`;
const evidence: string[] = [];
const log = (s: string) => { console.log(s); evidence.push(s); };

const m = new SomniaMarkets({ chain: hidekiTestnet as unknown as Chain, indexerUrl: INDEXER, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, privateKey: key });

async function main() {
  log(`\n## Smoke run ${new Date().toISOString()} — wallet ${me}`);
  const perps = await m.client.listPerpMarkets({ limit: 200 } as never);
  log(`- Listed ${perps.length} perp markets via indexer`);
  const stt = await m.client.getNativeBalance(me);
  log(`- STT balance: ${formatUnits(stt, 18)}`);
  if (stt === 0n) throw new Error("No STT for gas — fund the wallet first");

  // Paper USDso
  const btc = (await m.client.listPerpMarkets({ baseSymbol: "BTC" }))[0];
  const eth = (await m.client.listPerpMarkets({ baseSymbol: "ETH" }))[0];
  const el = await m.client.getPerpVoucherEligibility(btc.marginBank, me);
  if (el.eligible) {
    try {
      const r = await m.trader.claimPerpVoucher({ marginBank: btc.marginBank });
      log(`- Claimed paper USDso voucher: ${tx(r.hash)}`);
    } catch (e: any) {
      log(`- Voucher claim reverted (${(e?.shortMessage ?? e?.message ?? "").slice(0, 80)}); falling back to wallet USDso`);
    }
  } else log(`- Voucher: not eligible (${el.reason})`);
  // Faucet USDso lands in the wallet; perps margin must be in the MarginBank. Deposit whatever is there.
  const walletUsd = await m.client.getErc20Balance(btc.quoteToken as `0x${string}`, me);
  const pre = await m.client.getMarginAccount(btc.marginBank, me);
  if (walletUsd > 0n && pre.equity <= 0n) {
    const d = await m.trader.depositMargin({ marginBank: btc.marginBank, amount: walletUsd, collateral: btc.quoteToken as `0x${string}`, autoApprove: true });
    log(`- Deposited ${formatUnits(walletUsd, 18)} USDso into MarginBank: ${tx(d.hash)}`);
  }
  const acct = await m.client.getMarginAccount(btc.marginBank, me);
  log(`- Margin account: ${j(acct)}`);

  // Pick a market that the voucher allows
  for (const mk of [btc, eth]) {
    const st = await m.client.getPerpState(mk.poolAddress);
    const slip = (st.markPrice * 103n) / 100n; // 3% through the book for the IOC
    const alignedPrice = slip - (slip % BigInt(mk.tickSize));
    const max = await m.client.getMaxPerpOrderSize({ pool: mk.poolAddress, marginBank: mk.marginBank, account: me, isBid: true, price: alignedPrice });
    log(`- ${mk.baseSymbol} mark ${formatUnits(st.markPrice, 18)} maxSize ${j(max)}`);
    if (!max.priceable || !max.placeable) { log(`  skipped: limitedBy ${max.priceable ? max.limitedBy : "unpriceable"}`); continue; }
    // ~ $25 notional, aligned to lot, at least minQuantity
    let qty = (parseUnits("25", 18) * 10n ** BigInt(mk.baseDecimals)) / st.markPrice;
    const lot = BigInt(mk.lotSize), minQ = BigInt(mk.minQuantity);
    qty = qty - (qty % lot); if (qty < minQ) qty = minQ; if (qty > max.maxQuantity) qty = max.maxQuantity;
    log(`  opening LONG qty=${formatUnits(qty, mk.baseDecimals)} ${mk.baseSymbol} IOC @<=${formatUnits(alignedPrice, 18)}`);
    try {
      const open = await m.trader.placePerpOrder({ pool: mk.poolAddress, isBid: true, price: alignedPrice, quantity: qty, orderType: ORDER_TYPE.MARKET, gas: 10_000_000n });
      log(`  OPEN tx: ${tx(open.hash)} status=${open.receipt.status} fills=${open.fills.length}`);
    } catch (e: any) {
      log(`  OPEN failed: ${e?.name} ${e?.shortMessage ?? e?.message}`.slice(0, 400));
      continue;
    }
    const pos = await m.client.getPerpPosition({ marginBank: mk.marginBank, account: me, pool: mk.poolAddress });
    log(`  position: size=${formatUnits(pos.size, mk.baseDecimals)} entry=${formatUnits(pos.avgEntryPrice, 18)}`);
    if (pos.size === 0n) { log("  no fill — nothing to close"); continue; }
    const st2 = await m.client.getPerpState(mk.poolAddress);
    const down = (st2.markPrice * 97n) / 100n;
    const closePrice = down - (down % BigInt(mk.tickSize));
    const close = await m.trader.placePerpOrder({ pool: mk.poolAddress, isBid: pos.size < 0n, price: closePrice, quantity: pos.size < 0n ? -pos.size : pos.size, orderType: ORDER_TYPE.MARKET, gas: 10_000_000n });
    log(`  CLOSE tx: ${tx(close.hash)} status=${close.receipt.status} fills=${close.fills.length}`);
    const pos2 = await m.client.getPerpPosition({ marginBank: mk.marginBank, account: me, pool: mk.poolAddress });
    log(`  position after close: size=${formatUnits(pos2.size, mk.baseDecimals)}`);
    break;
  }
}

main()
  .catch((e) => { log(`- FAILED: ${e?.shortMessage ?? e?.message ?? e}`); process.exitCode = 1; })
  .finally(() => { appendFileSync("EVIDENCE.md", evidence.join("\n") + "\n"); process.exit(); });
