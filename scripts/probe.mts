import "dotenv/config";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatEther } from "viem";
const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES });
const perps = await m.client.listPerpMarkets();
for (const p of perps) console.log(p.baseSymbol, p.poolAddress, "base", p.baseDecimals, "quote", p.quoteDecimals, Object.keys(p).length);
console.log(JSON.stringify(perps[0], (_, v) => typeof v === "bigint" ? v.toString() : v, 1).slice(0, 2500));
const pc = createPublicClient({ chain: hidekiTestnet, transport: http() });
for (const k of [process.env.SMOKE_PRIVATE_KEY!, process.env.SMOKE_PRIVATE_KEY_2!]) {
  const a = privateKeyToAccount(k as `0x${string}`).address;
  const el = await m.client.getPerpVoucherEligibility(perps[0].marginBank, a);
  console.log(a, "STT", formatEther(await pc.getBalance({ address: a })), "voucher", JSON.stringify(el, (_, v) => typeof v === "bigint" ? v.toString() : v));
}
process.exit(0);
