import "dotenv/config";
import { formatUnits, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
const m = new SomniaMarkets({ chain: hidekiTestnet as unknown as Chain, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES });
const btc = (await m.client.listPerpMarkets({ baseSymbol: "BTC" }))[0];
for (const k of [process.env.SMOKE_PRIVATE_KEY!, process.env.SMOKE_PRIVATE_KEY_2!]) {
  const a = privateKeyToAccount(k as `0x${string}`).address;
  const p = await m.client.getPerpPosition({ marginBank: btc.marginBank, account: a, pool: btc.poolAddress });
  const acct = await m.client.getMarginAccount(btc.marginBank, a);
  console.log(a, "BTC size", formatUnits(p.size, btc.baseDecimals), "equity", formatUnits(acct.equity, 18));
}
process.exit(0);
