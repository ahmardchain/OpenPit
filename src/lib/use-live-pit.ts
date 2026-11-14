"use client";
/**
 * Live scoreboard data for one pit.
 *
 * Primary: Somnia Reactivity (`somnia_watch`) in the browser. We watch the PerpPool and its oracle; every matching log
 * arrives with same-block eth_calls already executed — the pool's mark price plus each participant's MarginBank
 * position — so the card re-scores on the exact block that moved it, with no follow-up round trips.
 * Fallback: an HTTP `tryGetMarkPrice` read runs immediately and every 2s until the socket delivers a block,
 * so a slow Reactivity handshake does not leave the mark on "Loading". If the watch fails to open, the
 * SDK client polls the same calls every 2s.
 */
import { useEffect, useState } from "react";
import { createPublicClient, decodeFunctionResult, encodeFunctionData, http, isAddress, type Address, type Hex } from "viem";
import { createReactivity, unwrap, type ReactivityNotification } from "@somnia-chain/markets-sdk/reactivity";
import { marginBankReadAbi, perpPoolReadAbi } from "./abi";
import { hideki, RPC_HTTP } from "./chain";
import { getExchange } from "./markets";
import type { PitView } from "./pit-view";

/** HTTP transport, independent of the SDK WebSocket the Reactivity watch opens. */
const httpClient = createPublicClient({ chain: hideki, transport: http(RPC_HTTP) });

export interface LiveState {
  mark: bigint | null;
  markOk: boolean;
  positions: Record<string, { size: bigint; avgEntryPrice: bigint }>;
  block: bigint | null;
  source: "reactivity" | "poll" | "connecting";
  updates: number;
  lastEvent: { address: string; topic: string } | null;
}

export function useLivePit(pit: PitView | null) {
  const [state, setState] = useState<LiveState>({ mark: null, markOk: false, positions: {}, block: null, source: "connecting", updates: 0, lastEvent: null });
  // Only on-chain players have a MarginBank position to read; paper players are scored from the mark alone.
  const wallets = pit ? Array.from(new Set(pit.joins.filter((j) => j.mode === "chain" && isAddress(j.wallet)).map((j) => j.wallet.toLowerCase()))) : [];
  const walletsKey = wallets.join(",");

  useEffect(() => {
    if (!pit) return;
    const pool = pit.pool as Address;
    const bank = pit.marginBank as Address;
    let stopped = false;
    let wsDelivered = false;
    let unsub: (() => Promise<void>) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let httpTimer: ReturnType<typeof setInterval> | null = null;

    const calls = [
      { to: pool, data: encodeFunctionData({ abi: perpPoolReadAbi, functionName: "tryGetMarkPrice" }) },
      ...wallets.map((w) => ({ to: bank, data: encodeFunctionData({ abi: marginBankReadAbi, functionName: "getPosition", args: [w as Address, pool] }) })),
    ];

    const apply = (results: Hex[], block: bigint | null, source: LiveState["source"], ev: LiveState["lastEvent"]) => {
      if (stopped) return;
      try {
        const [ok, price] = decodeFunctionResult({ abi: perpPoolReadAbi, functionName: "tryGetMarkPrice", data: results[0] });
        const positions: LiveState["positions"] = {};
        wallets.forEach((w, i) => {
          const r = results[i + 1];
          if (!r || r === "0x") return;
          const p = decodeFunctionResult({ abi: marginBankReadAbi, functionName: "getPosition", data: r });
          positions[w] = { size: p.size, avgEntryPrice: p.avgEntryPrice };
        });
        setState((s) => ({
          mark: ok ? price : s.mark,
          markOk: ok,
          positions,
          block,
          // An HTTP read that lands after the socket is open should not downgrade the label.
          source: source === "poll" && s.source === "reactivity" ? s.source : source,
          updates: s.updates + 1,
          lastEvent: ev ?? s.lastEvent,
        }));
      } catch {
        /* a malformed result batch: keep the previous state */
      }
    };

    const readOverHttp = async () => {
      if (stopped || wsDelivered) return;
      try {
        const block = await httpClient.getBlockNumber();
        if (stopped || wsDelivered) return;
        const results = await Promise.all(calls.map((c) => httpClient.call({ to: c.to, data: c.data, blockNumber: block }).then((r) => (r.data ?? "0x") as Hex)));
        if (stopped || wsDelivered) return;
        apply(results, block, "poll", null);
      } catch {
        /* HTTP RPC hiccup; the interval retries until the socket delivers */
      }
    };

    const stopHttp = () => {
      wsDelivered = true;
      if (httpTimer) clearInterval(httpTimer);
      httpTimer = null;
    };

    void readOverHttp();
    httpTimer = setInterval(() => void readOverHttp(), 2000);

    (async () => {
      let ex: ReturnType<typeof getExchange>;
      try {
        ex = getExchange();
      } catch {
        return;
      }
      const viem = ex.client.getViemClient();
      const pollOnce = async (source: LiveState["source"]) => {
        try {
          const block = await viem.getBlockNumber();
          const results = await Promise.all(calls.map((c) => viem.call({ to: c.to, data: c.data, blockNumber: block }).then((r) => (r.data ?? "0x") as Hex)));
          apply(results, block, source, null);
        } catch {
          /* transient RPC hiccup; next tick retries */
        }
      };
      const startPoll = () => {
        if (pollTimer) return;
        void pollOnce("poll");
        pollTimer = setInterval(() => void pollOnce("poll"), 2000);
      };
      try {
        const st = await ex.client.getPerpState(pool);
        if (stopped) return;
        const reactivity = createReactivity(ex.client);
        const watch = unwrap(
          await reactivity.watch({
            // The pool (fills/funding on this market) and its mark oracle. MarginBank is deliberately left out:
            // it emits for every market on the venue, and the positions we need are already in ethCalls.
            eventContractSources: [pool, st.oracle as Address],
            onlyPushChanges: true,
            ethCalls: calls,
            onData: (n: ReactivityNotification) => {
              stopHttp();
              const r = n.result;
              apply(r.simulationResults, null, "reactivity", { address: r.address, topic: r.topics[0] });
            },
            onError: () => {
              wsDelivered = false;
              if (!httpTimer) {
                void readOverHttp();
                httpTimer = setInterval(() => void readOverHttp(), 2000);
              }
              startPoll();
            },
          }),
        );
        if (stopped) {
          await watch.unsubscribe();
          return;
        }
        unsub = async () => {
          await watch.unsubscribe();
        };
        // Reactivity fires on events; keep a slow heartbeat so a quiet market still shows a fresh block number.
        pollTimer = setInterval(() => void pollOnce("reactivity"), 10_000);
      } catch {
        startPoll();
      }
    })();

    return () => {
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      if (httpTimer) clearInterval(httpTimer);
      unsub?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pit?.id, walletsKey]);

  return state;
}
