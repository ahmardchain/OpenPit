import type { Chain } from "viem";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
const m = new SomniaMarkets({ chain: hidekiTestnet as unknown as Chain, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES });
const perps = await m.client.listPerpMarkets({ limit: 200 } as any);
const j = (x: any) => JSON.stringify(x, (_, v) => typeof v === "bigint" ? v.toString() : v);
console.log(perps.map(p => p.baseSymbol).join(" "));
const camp = await m.client.getPerpVoucherCampaign(perps[0].marginBank);
console.log("campaign", j(camp));
for (const s of ["BTC", "ETH", "SOL"]) {
  const p = (await m.client.listPerpMarkets({ baseSymbol: s }))[0]; if (!p) { console.log(s, "missing"); continue; }
  const st = await m.client.getPerpState(p.poolAddress);
  console.log(s, p.poolAddress, "tick", p.tickSize, "lot", p.lotSize, "minQ", p.minQuantity, "state", j(st));
  const max = await m.client.getMaxPerpOrderSize({ pool: p.poolAddress, marginBank: p.marginBank, account: "0x86f95901932352e0f25B6c4807268334D97c065C", isBid: true, price: st.markPrice });
  console.log("  max", j(max));
}
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(m.client)).filter(n => /oucher|Book|Top/i.test(n)).join(" "));
process.exit(0);
