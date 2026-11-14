"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { hideki } from "@/lib/chain";

// Wallets are discovered through EIP-6963 (MetaMask, Rabby, Brave, OKX and other browser wallets announce
// themselves), so no wallet SDKs are bundled. RainbowKit's modal lists every discovered wallet.
const config = createConfig({
  chains: [hideki],
  connectors: [],
  multiInjectedProviderDiscovery: true,
  transports: { [hideki.id]: http(hideki.rpcUrls.default.http[0]) },
  ssr: true,
});

const SignerBinding = dynamic(() => import("@/components/signer-binding"), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <SignerBinding />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
