"use client";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { getExchange } from "@/lib/markets";
import { fmtUsd } from "@/lib/scoring";
import { txUrl } from "@/lib/chain";
import { useTrade } from "@/lib/use-trade";
import { Spinner } from "./ui";

/** USDso, the perps collateral on Hideki (also readable from any market row's quoteToken). */
const USDSO = "0xed7993A74dAe1e6656B704A424DcD8711aAf4F72" as const;

/** Shows the wallet's Perps margin and offers the one-time paper-USDso claim. Numbers come straight from MarginBank. */
export function MarginStatus({ marginBank }: { marginBank: Address }) {
  const { address, claimVoucher, depositAll, busy } = useTrade();
  const [walletUsd, setWalletUsd] = useState<bigint | null>(null);
  const [equity, setEquity] = useState<bigint | null>(null);
  const [stt, setStt] = useState<bigint | null>(null);
  const [eligible, setEligible] = useState<{ eligible: boolean; reason?: string } | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let stop = false;
    const run = async () => {
      try {
        const ex = getExchange();
        const [acct, el, bal, usd] = await Promise.all([
          ex.client.getMarginAccount(marginBank, address),
          ex.client.getPerpVoucherEligibility(marginBank, address),
          ex.client.getNativeBalance(address),
          ex.client.getErc20Balance(USDSO, address),
        ]);
        if (stop) return;
        setWalletUsd(usd);
        setEquity(acct.equity);
        setStt(bal);
        setEligible(el.eligible ? { eligible: true } : { eligible: false, reason: el.reason });
        setErr(null);
      } catch (e) {
        if (!stop) setErr((e as Error).message);
      }
    };
    run();
    const t = setInterval(run, 6000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [address, marginBank, claimTx]);

  if (!address) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span>
        Perps equity: <b className="tabular text-fg">{equity === null ? <Spinner /> : fmtUsd(equity)}</b>
      </span>
      <span>
        STT: <b className="tabular text-fg">{stt === null ? "…" : (Number(stt) / 1e18).toFixed(3)}</b>
      </span>
      {stt !== null && stt === 0n && <span className="text-fade">no STT for gas — top up on app.testnet.dreamdex.io (Link a Bot → Send for gas)</span>}
      {eligible?.eligible && (
        <button
          disabled={!!busy}
          onClick={async () => {
            try {
              setClaimTx(await claimVoucher(marginBank));
            } catch {
              /* shown by ErrorBox on the page */
            }
          }}
          className="rounded-md border border-line bg-surface-2 px-2 py-1 font-semibold text-long disabled:opacity-50"
        >
          Claim 1,000 paper USDso
        </button>
      )}
      {walletUsd !== null && walletUsd > 0n && (
        <button
          disabled={!!busy}
          onClick={async () => {
            try {
              setClaimTx(await depositAll(marginBank, USDSO));
            } catch {
              /* shown by ErrorBox on the page */
            }
          }}
          className="rounded-md border border-line bg-surface-2 px-2 py-1 font-semibold text-accent disabled:opacity-50"
        >
          Deposit {(Number(walletUsd) / 1e18).toFixed(0)} wallet USDso into Perps
        </button>
      )}
      {eligible && !eligible.eligible && equity !== null && equity <= 0n && <span className="text-accent">voucher: {eligible.reason}</span>}
      {claimTx && (
        <a className="text-long underline" href={txUrl(claimTx)} target="_blank" rel="noreferrer">
          claimed ↗
        </a>
      )}
      {err && <span className="text-fade">{err.slice(0, 80)}</span>}
    </div>
  );
}
