"use client";
import dynamic from "next/dynamic";

/** RainbowKit's connect button, loaded in the browser only. The server renders a same-sized placeholder. */
export const WalletButton = dynamic(() => import("./wallet-button-impl"), {
  ssr: false,
  loading: () => (
    <span className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink opacity-80">Connect Wallet</span>
  ),
});
