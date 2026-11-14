import { verifyMessage, type Address, type Hex } from "viem";

/** The EIP-191 message a creator signs. Stored verbatim with the pit so anyone can re-verify it. */
export interface PitIntent {
  app: "OpenPit";
  chainId: number;
  market: string; // base symbol, e.g. BTC
  pool: Address;
  side: "long" | "short";
  durationMin: number;
  capUsd: number;
  thesis: string;
  creator: Address;
  nonce: string;
}

export function intentMessage(i: PitIntent): string {
  return [
    `OpenPit pit intent`,
    `chain: ${i.chainId}`,
    `market: ${i.market}-PERP (${i.pool})`,
    `creator side: ${i.side.toUpperCase()}`,
    `duration: ${i.durationMin} min`,
    `cap per trader: ${i.capUsd} USDso`,
    `thesis: ${i.thesis || "(none)"}`,
    `creator: ${i.creator}`,
    `nonce: ${i.nonce}`,
  ].join("\n");
}

export async function verifyIntent(i: PitIntent, signature: Hex): Promise<boolean> {
  try {
    return await verifyMessage({ address: i.creator, message: intentMessage(i), signature });
  } catch {
    return false;
  }
}
