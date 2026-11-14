/** Turn SDK / wallet / RPC failures into one friendly sentence. Never swallows the raw message. */
export function friendlyError(e: unknown): { title: string; detail: string } {
  const err = e as { name?: string; errorName?: string; shortMessage?: string; message?: string; code?: number; cause?: unknown };
  const raw = err?.shortMessage ?? err?.message ?? String(e);
  const name = err?.errorName ?? "";
  const text = `${name} ${raw}`;

  if (/ImmediateOrCancelNoFill|d48c4403/i.test(text))
    return { title: "No liquidity at that price", detail: "Your IOC order found nothing to fill, so the pool refused it and nothing was opened. Try again in a moment or with a smaller size." };
  if (/voucherBlocked|VoucherMarketNotAllowed|VoucherBlocked/i.test(text))
    return { title: "Paper USDso can't trade this market", detail: "Your 1,000 paper-USDso credit only opens positions on its allowlisted markets. Pick BTC or ETH, or deposit your own USDso." };
  if (/IsolatedMarketBlocked/i.test(text))
    return { title: "Isolated account", detail: "This account is isolated to one market and can't trade this pit's market." };
  if (/QuantityBelowMinimum|PositionBelowMinQuantity|below.*minQuantity|minQuantity/i.test(text))
    return { title: "Below the market minimum", detail: "The cap is too small for this market's minimum order size. Raise the cap or pick a cheaper market." };
  if (/InsufficientCollateral|collateral|no USDso|transfer amount exceeds balance/i.test(text))
    return { title: "No USDso margin", detail: "Your Perps account has no collateral. Claim the paper-USDso voucher (button above) or move USDso into Perps on app.testnet.dreamdex.io." };
  if (/chain|ChainMismatch|wrong network|Unsupported chain|switch/i.test(text) && !/unchanged/i.test(text))
    return { title: "Wrong network", detail: "Switch your wallet to Somnia Hideki testnet (chain 50383) and try again." };
  if (/User rejected|user denied|rejected the request|4001/i.test(text))
    return { title: "Signature cancelled", detail: "You dismissed the wallet prompt. Nothing was sent." };
  if (/insufficient funds|gas required exceeds|intrinsic gas/i.test(text))
    return { title: "Not enough STT for gas", detail: "Top up STT on Hideki (Link a Bot → 'Send it for gas' on app.testnet.dreamdex.io) and retry." };
  if (/genesis check failed|WebSocket|ws:/i.test(text))
    return { title: "RPC WebSocket unreachable", detail: "The SDK needs the wss:// endpoint. Check NEXT_PUBLIC_RPC_WS and your network." };
  return { title: "Transaction failed", detail: raw.slice(0, 300) };
}
