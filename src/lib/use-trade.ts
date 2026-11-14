"use client";
/**
 * Browser-side trading helpers. Every order is signed by the connected wallet and sent to the PerpPool
 * through the dreamDEX SDK — non-custodial by construction.
 */
import { useCallback, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { ORDER_TYPE } from "@somnia-chain/markets-sdk";
import type { Address } from "viem";
import { CHAIN_ID } from "./chain";
import { getExchange } from "./markets";
import { alignLot, alignTick } from "./scoring";

export interface MarketParams {
  pool: Address;
  marginBank: Address;
  baseDecimals: number;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
}

export interface SizingPreview {
  priceable: boolean;
  placeable: boolean;
  limitedBy?: string;
  maxQuantity: bigint;
  /** Quantity we will send: min(cap-worth, max) aligned to the lot grid. */
  qty: bigint;
  price: bigint;
  mark: bigint;
  belowMin: boolean;
}

/** Size a crossing IOC for `capUsd` of notional, clamped by getMaxPerpOrderSize and aligned to tick/lot. */
export async function previewSize(m: MarketParams, account: Address, isBid: boolean, capUsd: number): Promise<SizingPreview> {
  const ex = getExchange();
  const st = await ex.client.getPerpState(m.pool);
  const mark = st.markPrice;
  // 2% through the book so the IOC actually fills; a crossing price only bounds the margin lock.
  const raw = isBid ? (mark * 102n) / 100n : (mark * 98n) / 100n;
  const price = alignTick(raw, BigInt(m.tickSize), isBid);
  const max = await ex.client.getMaxPerpOrderSize({ pool: m.pool, marginBank: m.marginBank, account, isBid, price });
  if (!max.priceable) return { priceable: false, placeable: false, maxQuantity: 0n, qty: 0n, price, mark, belowMin: false };
  const oneBase = 10n ** BigInt(m.baseDecimals);
  const capRaw = BigInt(Math.round(capUsd * 1e6)) * 10n ** 12n;
  let qty = alignLot((capRaw * oneBase) / mark, BigInt(m.lotSize));
  if (qty > max.maxQuantity) qty = alignLot(max.maxQuantity, BigInt(m.lotSize));
  const belowMin = qty < BigInt(m.minQuantity);
  return { priceable: true, placeable: max.placeable && !belowMin, limitedBy: max.placeable ? undefined : max.limitedBy, maxQuantity: max.maxQuantity, qty, price, mark, belowMin };
}

export function useTrade() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const ensureChain = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first.");
    if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID });
  }, [address, chainId, switchChainAsync]);

  /** Open (or add to) a position for ~capUsd notional. Returns the tx hash and fills. */
  const openFor = useCallback(
    async (m: MarketParams, isBid: boolean, capUsd: number) => {
      setError(null);
      setBusy("Sizing order…");
      try {
        await ensureChain();
        const s = await previewSize(m, address!, isBid, capUsd);
        if (!s.priceable) throw new Error("No live mark price to size against; the feed is stale.");
        if (s.belowMin) throw Object.assign(new Error("Below minQuantity"), { errorName: "QuantityBelowMinimum" });
        if (!s.placeable) throw Object.assign(new Error(`Cannot place: limitedBy ${s.limitedBy}`), { errorName: s.limitedBy });
        setBusy("Confirm in wallet…");
        const r = await getExchange().trader.placePerpOrder({ pool: m.pool, isBid, price: s.price, quantity: s.qty, orderType: ORDER_TYPE.MARKET, gas: 10_000_000n });
        return { hash: r.hash, fills: r.fills, qty: s.qty };
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setBusy(null);
      }
    },
    [address, ensureChain],
  );

  /** Reduce-only close: an opposite-side IOC sized to the current position (never flips). */
  const closePosition = useCallback(
    async (m: MarketParams) => {
      setError(null);
      setBusy("Reading position…");
      try {
        await ensureChain();
        const ex = getExchange();
        const pos = await ex.client.getPerpPosition({ marginBank: m.marginBank, account: address!, pool: m.pool });
        if (pos.size === 0n) throw new Error("No open position on this market.");
        const isBid = pos.size < 0n;
        const st = await ex.client.getPerpState(m.pool);
        const raw = isBid ? (st.markPrice * 102n) / 100n : (st.markPrice * 98n) / 100n;
        const price = alignTick(raw, BigInt(m.tickSize), isBid);
        const qty = alignLot(pos.size < 0n ? -pos.size : pos.size, BigInt(m.lotSize));
        setBusy("Confirm in wallet…");
        const r = await ex.trader.placePerpOrder({ pool: m.pool, isBid, price, quantity: qty, orderType: ORDER_TYPE.MARKET, gas: 10_000_000n });
        return { hash: r.hash, fills: r.fills, qty };
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setBusy(null);
      }
    },
    [address, ensureChain],
  );

  const claimVoucher = useCallback(
    async (marginBank: Address) => {
      setError(null);
      setBusy("Claiming paper USDso…");
      try {
        await ensureChain();
        const r = await getExchange().trader.claimPerpVoucher({ marginBank });
        return r.hash;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setBusy(null);
      }
    },
    [ensureChain],
  );

  return { address, chainId, wrongChain: !!address && chainId !== CHAIN_ID, busy, error, setError, openFor, closePosition, claimVoucher };
}
