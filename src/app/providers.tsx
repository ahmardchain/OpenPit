"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { WagmiProvider, useWalletClient } from "wagmi";
import { hideki } from "@/lib/chain";
import { getExchange } from "@/lib/markets";

const config = getDefaultConfig({
  appName: "OpenPit",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "openpit-local",
  chains: [hideki],
  ssr: true,
});

/** Binds the connected wallet to the SDK trader so orders are signed by the user, never by a server. */
function SignerBinding() {
  const { data: walletClient } = useWalletClient();
  useEffect(() => {
    getExchange().setSigner(walletClient ? { walletClient } : {});
  }, [walletClient]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#f5a524", accentColorForeground: "#1a1206", borderRadius: "medium" })} initialChain={hideki}>
          <SignerBinding />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
