"use client";
import { useEffect } from "react";
import { useWalletClient } from "wagmi";
import { getExchange } from "@/lib/markets";

/** Binds the connected wallet to the SDK trader so orders are signed by the user, never by a server. */
export default function SignerBinding() {
  const { data: walletClient } = useWalletClient();
  useEffect(() => {
    getExchange().setSigner(walletClient ? { walletClient } : {});
  }, [walletClient]);
  return null;
}
