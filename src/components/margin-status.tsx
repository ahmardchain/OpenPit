"use client";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { getExchange } from "@/lib/markets";
import { fmtUsd } from "@/lib/scoring";
import { txUrl } from "@/lib/chain";
import { useTrade } from "@/lib/use-trade";
import { Spinner } from "./ui";

/** Shows the wallet's Perps margin and offers the one-time paper-USDso claim. Numbers come straight from MarginBank. */
export function MarginStatus({ marginBank }: { marginBank: Address }) {
  const { address, claimVoucher, busy } = useTrade();
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
        const [acct, el, bal] = await Promise.all([
          ex.client.getMarginAccount(marginBank, address),
          ex.client.getPerpVoucherEligibility(marginBank, address),
          ex.client.getNativeBalance(address),
        ]);
        if (stop) return;
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
      <span>
        Perps equity: <b className="tabular text-zinc-200">{equity === null ? <Spinner /> : fmtUsd(equity)}</b>
      </span>
      <span>
        STT: <b className="tabular text-zinc-200">{stt === null ? "…" : (Number(stt) / 1e18).toFixed(3)}</b>
      </span>
      {stt !== null && stt === 0n && <span className="text-rose-300">no STT for gas — top up on app.testnet.dreamdex.io (Link a Bot → Send for gas)</span>}
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
          className="rounded-md bg-emerald-500/20 px-2 py-1 font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          Claim 1,000 paper USDso
        </button>
      )}
      {eligible && !eligible.eligible && equity !== null && equity <= 0n && <span className="text-amber-300">voucher: {eligible.reason}</span>}
      {claimTx && (
        <a className="text-emerald-300 underline" href={txUrl(claimTx)} target="_blank" rel="noreferrer">
          claimed ↗
        </a>
      )}
      {err && <span className="text-rose-300">{err.slice(0, 80)}</span>}
    </div>
  );
}
