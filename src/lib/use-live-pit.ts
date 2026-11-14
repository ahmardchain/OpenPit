"use client";
/**
 * Live scoreboard data for one pit.
 *
 * Primary: Somnia Reactivity (`somnia_watch`) in the browser. We watch the PerpPool and its oracle; every matching log
 * arrives with same-block eth_calls already executed — the pool's mark price plus each participant's MarginBank
 * position — so the card re-scores on the exact block that moved it, with no follow-up round trips.
 * Fallback: if the watch fails to open, a 2s poll runs the same reads over the SDK's client.
 */
import { useEffect, useRef, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, type Address, type Hex } from "viem";
import { createReactivity, unwrap, type ReactivityNotification } from "@somnia-chain/markets-sdk/reactivity";
import { marginBankReadAbi, perpPoolReadAbi } from "./abi";
import { getExchange } from "./markets";
import type { PitView } from "./pit-view";

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
  const wallets = pit ? Array.from(new Set(pit.joins.map((j) => j.wallet.toLowerCase()))) : [];
  const walletsKey = wallets.join(",");
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!pit) return;
    const ex = getExchange();
    const viem = ex.client.getViemClient();
    const pool = pit.pool as Address;
    const bank = pit.marginBank as Address;
    let stopped = false;
    let unsub: (() => Promise<void>) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

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
        setState((s) => ({ mark: ok ? price : s.mark, markOk: ok, positions, block, source, updates: s.updates + 1, lastEvent: ev ?? s.lastEvent }));
      } catch {
        /* a malformed result batch: keep the previous state */
      }
    };

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
      pollOnce("poll");
      pollTimer = setInterval(() => pollOnce("poll"), 2000);
    };

    (async () => {
      // Seed immediately so the card is never blank while the socket opens.
      await pollOnce("connecting");
      try {
        const st = await ex.client.getPerpState(pool);
        const reactivity = createReactivity(ex.client);
        const watch = unwrap(
          await reactivity.watch({
            eventContractSources: [pool, st.oracle as Address, bank],
            ethCalls: calls,
            onData: (n: ReactivityNotification) => {
              const r = n.result;
              apply(r.simulationResults, null, "reactivity", { address: r.address, topic: r.topics[0] });
            },
            onError: () => startPoll(),
          }),
        );
        if (stopped) {
          await watch.unsubscribe();
          return;
        }
        unsub = async () => {
          await watch.unsubscribe();
        };
        setState((s) => ({ ...s, source: "reactivity" }));
        // Reactivity fires on events; keep a slow heartbeat so a quiet market still shows a fresh block number.
        pollTimer = setInterval(() => pollOnce("reactivity"), 10_000);
      } catch {
        startPoll();
      }
    })();

    return () => {
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      unsub?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pit?.id, walletsKey]);

  return state;
}
