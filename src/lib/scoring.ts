/** Pure scoring helpers. All prices are 18-decimal USDso per whole base; quantities are raw base units. */

export type Side = "long" | "short";

/** Unrealized PnL of a fixed-size session position in raw USDso (18 dec), truncated toward zero. */
export function sessionPnl(side: Side, qty: bigint, entry: bigint, mark: bigint, baseDecimals: number): bigint {
  const oneBase = 10n ** BigInt(baseDecimals);
  const diff = side === "long" ? mark - entry : entry - mark;
  return (qty * diff) / oneBase;
}

/** Return on cap in basis points: pnl / cap. Cap is raw USDso (18 dec). Size does not win; cap is the denominator for everyone. */
export function returnOnCapBps(pnl: bigint, cap: bigint): number {
  if (cap === 0n) return 0;
  return Number((pnl * 10_000n * 1000n) / cap) / 1000;
}

export function notional(qty: bigint, price: bigint, baseDecimals: number): bigint {
  return (qty * price) / 10n ** BigInt(baseDecimals);
}

/** Pretty-print raw USDso. */
export function fmtUsd(raw: bigint, digits = 2): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const whole = abs / 10n ** 18n;
  const frac = abs % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0").slice(0, digits);
  const wholeStr = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}$${wholeStr}${digits > 0 ? "." + fracStr : ""}`;
}

export function fmtPct(bps: number, digits = 2): string {
  const s = (bps / 100).toFixed(digits);
  return `${bps > 0 ? "+" : ""}${s}%`;
}

export function fmtQty(raw: bigint, baseDecimals: number, digits = 5): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const one = 10n ** BigInt(baseDecimals);
  const whole = abs / one;
  const frac = (abs % one).toString().padStart(baseDecimals, "0").slice(0, digits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

/** Align a raw quantity down to the lot grid. */
export function alignLot(qty: bigint, lot: bigint): bigint {
  return qty - (qty % lot);
}

/** Align a price to the tick grid (down for bids, up for asks keeps you crossing). */
export function alignTick(price: bigint, tick: bigint, up: boolean): bigint {
  const rem = price % tick;
  if (rem === 0n) return price;
  return up ? price - rem + tick : price - rem;
}
