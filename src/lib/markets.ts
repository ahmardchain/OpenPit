"use client";
/**
 * Browser-side dreamDEX client. One SomniaMarkets instance per tab (module scope), signer bound on wallet connect.
 * Orders go wallet → PerpPool directly through the SDK; this app's server never sees a key.
 */
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { INDEXER_URL, RPC_WS, hideki } from "./chain";

let instance: SomniaMarkets | null = null;

export function getExchange(): SomniaMarkets {
  if (!instance) {
    instance = new SomniaMarkets({ chain: hideki, wsRpcUrl: RPC_WS, indexerUrl: INDEXER_URL, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES });
  }
  return instance;
}

export interface PitMarket {
  symbol: string;
  pool: `0x${string}`;
  marginBank: `0x${string}`;
  baseDecimals: number;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  markPrice: string | null;
}
