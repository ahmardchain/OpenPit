import "dotenv/config";
import type { Chain } from "viem";
import { formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
const m = new SomniaMarkets({ chain: hidekiTestnet as unknown as Chain, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES });
const j = (x: any) => JSON.stringify(x, (_, v) => typeof v === "bigint" ? v.toString() : v);
const USDSO = "0xed7993A74dAe1e6656B704A424DcD8711aAf4F72" as const;
const BANK = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394" as const;
for (const k of [process.env.SMOKE_PRIVATE_KEY!, process.env.SMOKE_PRIVATE_KEY_2!]) {
  const a = privateKeyToAccount(k as `0x${string}`).address;
  const [el, bal, allow, acct, v] = await Promise.all([
    m.client.getPerpVoucherEligibility(BANK, a),
    m.client.getErc20Balance(USDSO, a),
    m.client.getErc20Allowance(USDSO, a, BANK),
    m.client.getMarginAccount(BANK, a),
    m.client.getPerpVoucher(BANK, a),
  ]);
  console.log(a, "\n  eligibility", j(el), "\n  USDso wallet", formatUnits(bal, 18), "allowance→bank", formatUnits(allow, 18), "\n  margin", j(acct), "\n  voucher", j(v));
}
process.exit(0);
