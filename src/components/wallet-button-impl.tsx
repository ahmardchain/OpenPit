"use client";
// Browser-only: RainbowKit (and its ~2 MB of locale files) is kept out of the Cloudflare Worker's server bundle.
import "@rainbow-me/rainbowkit/styles.css";
import { ConnectButton, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { hideki } from "@/lib/chain";

const theme = darkTheme({ accentColor: "#3B6CFF", accentColorForeground: "#ffffff", borderRadius: "small" });

export default function WalletButtonImpl(props: React.ComponentProps<typeof ConnectButton>) {
  return (
    <RainbowKitProvider theme={theme} initialChain={hideki}>
      <ConnectButton {...props} />
    </RainbowKitProvider>
  );
}
