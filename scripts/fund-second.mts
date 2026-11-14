/**
 * Splits the first test wallet's testnet funds with the second one so the two-wallet e2e can run:
 * withdraws 50 USDso from wallet 1's MarginBank balance, sends it + 10 STT to wallet 2. Testnet only.
 *   npm run fund:second
 */
import "dotenv/config";
import { createWalletClient, erc20Abi, http, parseEther, parseUnits, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const chain = hidekiTestnet as unknown as Chain;
const a1 = privateKeyToAccount(process.env.SMOKE_PRIVATE_KEY as `0x${string}`);
const a2 = privateKeyToAccount(process.env.SMOKE_PRIVATE_KEY_2 as `0x${string}`);
const BANK = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394" as const;
const USDSO = "0xed7993A74dAe1e6656B704A424DcD8711aAf4F72" as const;
const USD = process.env.FUND_USDSO ?? "50";
const STT = process.env.FUND_STT ?? "10";

const m = new SomniaMarkets({ chain, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, privateKey: process.env.SMOKE_PRIVATE_KEY as `0x${string}` });
const pc = m.client.getViemClient();
const wc = createWalletClient({ account: a1, chain, transport: http() });

const wallet = await m.client.getErc20Balance(USDSO, a1.address);
if (wallet < parseUnits(USD, 18)) {
  const w = await m.trader.withdrawMargin({ marginBank: BANK, amount: parseUnits(USD, 18) - wallet });
  console.log(`withdrew USDso from MarginBank: ${w.hash}`);
}
const t1 = await wc.writeContract({ address: USDSO, abi: erc20Abi, functionName: "transfer", args: [a2.address, parseUnits(USD, 18)] });
await pc.waitForTransactionReceipt({ hash: t1 });
console.log(`sent ${USD} USDso to ${a2.address}: ${t1}`);
const t2 = await wc.sendTransaction({ to: a2.address, value: parseEther(STT) });
await pc.waitForTransactionReceipt({ hash: t2 });
console.log(`sent ${STT} STT to ${a2.address}: ${t2}`);
process.exit(0);
