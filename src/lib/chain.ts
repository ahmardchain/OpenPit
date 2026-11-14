import { hidekiTestnet as sdkHideki } from "@somnia-chain/markets-sdk/chains";
import { defineChain, type Chain } from "viem";

export const RPC_HTTP = process.env.NEXT_PUBLIC_RPC_HTTP ?? "https://api.hideki2.infra.testnet.somnia.network";
export const RPC_WS = process.env.NEXT_PUBLIC_RPC_WS ?? "wss://api.hideki2.infra.testnet.somnia.network/ws";
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER ?? "https://hideki-dev.smk.somnia.host/v1/graphql";
export const EXPLORER = "https://explorer.testnet.somnia.network/tokyo";
export const CHAIN_ID = 50383;

/** Hideki testnet, as the SDK defines it, with the RPC endpoints from env and an explorer for wallets. */
export const hideki = defineChain({
  ...(sdkHideki as unknown as Chain),
  rpcUrls: { default: { http: [RPC_HTTP], webSocket: [RPC_WS] } },
  blockExplorers: { default: { name: "Somnia Explorer", url: EXPLORER } },
});

/** Markets OpenPit offers. Read from the indexer at runtime; this is only the pick-list order. */
export const PIT_MARKETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "HYPE", "LINK", "AVAX", "SUI"] as const;

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
