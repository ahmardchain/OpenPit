/**
 * Server-side chain reads. HTTP-only viem client: the server never holds keys and never needs the SDK's WebSocket.
 * Everything here is a verification or a read-at-block; all writes happen in the user's browser wallet.
 */
import { createPublicClient, decodeEventLog, http, type Address, type Hash, type Hex } from "viem";
import { hideki } from "./chain";
import { marginBankReadAbi, orderFilledEvent, perpPoolReadAbi, positionUpdatedEvent } from "./abi";

export const serverClient = createPublicClient({ chain: hideki, transport: http(hideki.rpcUrls.default.http[0]) });

export interface VerifiedOrder {
  from: Address;
  blockNumber: number;
  /** Sum of fills in this tx. 0n when the order rested or was refused. */
  filledQty: bigint;
  /** Volume-weighted average fill price (18 dec). 0n when nothing filled. */
  avgFill: bigint;
  /** Position after the tx as emitted by MarginBank, if it emitted one for this account+pool. */
  newSize: bigint | null;
  avgEntryPrice: bigint | null;
  /** Mark price at the tx block. */
  markAtBlock: bigint;
}

/**
 * Verify that `hash` is a successful transaction sent by `expectedFrom` to `pool`, and extract fills + resulting position.
 * Throws with a human reason when anything does not line up — the API returns that reason as 4xx.
 */
export async function verifyOrderTx(hash: Hash, expectedFrom: Address, pool: Address, marginBank: Address): Promise<VerifiedOrder> {
  const receipt = await serverClient.getTransactionReceipt({ hash }).catch(() => null);
  if (!receipt) throw new Error("Transaction not found on Hideki yet — wait for confirmation and retry.");
  if (receipt.status !== "success") throw new Error("Transaction reverted on-chain; no position was opened.");
  const tx = await serverClient.getTransaction({ hash });
  if (tx.from.toLowerCase() !== expectedFrom.toLowerCase()) throw new Error("Transaction was not sent by the connected wallet.");
  if ((tx.to ?? "").toLowerCase() !== pool.toLowerCase()) throw new Error("Transaction did not target this pit's PerpPool.");

  let filledQty = 0n;
  let notionalSum = 0n;
  let newSize: bigint | null = null;
  let avgEntryPrice: bigint | null = null;
  for (const log of receipt.logs) {
    const addr = log.address.toLowerCase();
    try {
      if (addr === pool.toLowerCase()) {
        const d = decodeEventLog({ abi: [orderFilledEvent], data: log.data, topics: log.topics as [Hex, ...Hex[]] });
        filledQty += d.args.quantityFilled;
        notionalSum += d.args.quantityFilled * d.args.fillPrice;
      } else if (addr === marginBank.toLowerCase()) {
        const d = decodeEventLog({ abi: [positionUpdatedEvent], data: log.data, topics: log.topics as [Hex, ...Hex[]] });
        if (d.args.account.toLowerCase() === expectedFrom.toLowerCase() && d.args.perpPool.toLowerCase() === pool.toLowerCase()) {
          newSize = d.args.newSize;
          avgEntryPrice = d.args.avgEntryPrice;
        }
      }
    } catch {
      /* not one of ours */
    }
  }
  const [ok, mark] = await serverClient.readContract({ address: pool, abi: perpPoolReadAbi, functionName: "tryGetMarkPrice", blockNumber: receipt.blockNumber });
  return {
    from: tx.from,
    blockNumber: Number(receipt.blockNumber),
    filledQty,
    avgFill: filledQty > 0n ? notionalSum / filledQty : 0n,
    newSize,
    avgEntryPrice,
    markAtBlock: ok ? mark : 0n,
  };
}

export async function readMark(pool: Address, blockNumber?: bigint) {
  const [ok, price] = await serverClient.readContract({ address: pool, abi: perpPoolReadAbi, functionName: "tryGetMarkPrice", blockNumber });
  return { ok, price };
}

export async function readPosition(marginBank: Address, account: Address, pool: Address, blockNumber?: bigint) {
  return serverClient.readContract({ address: marginBank, abi: marginBankReadAbi, functionName: "getPosition", args: [account, pool], blockNumber });
}

export async function headBlock() {
  return serverClient.getBlockNumber();
}
