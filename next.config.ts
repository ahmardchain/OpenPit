import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Gives `next dev` the same Cloudflare bindings (local D1) the deployed Worker has.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    // Coinbase/Base wallet SDKs are pulled in by wagmi's connector list but not offered here; their optional
    // sub-dependencies cannot be bundled for Cloudflare Workers, so they resolve to an empty module.
    resolveAlias: {
      "@base-org/account": "./src/lib/empty.ts",
      "@coinbase/cdp-sdk": "./src/lib/empty.ts",
      "@coinbase/wallet-sdk": "./src/lib/empty.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
