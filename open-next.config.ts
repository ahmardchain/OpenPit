import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// `npm run build` runs `opennextjs-cloudflare build`, which needs its own Next.js build command;
// pointing it at `next build` directly avoids it calling `npm run build` again in a loop.
export default {
  ...defineCloudflareConfig({}),
  buildCommand: "npx next build",
};
