// Only active in sandboxed environments that require an egress proxy (HTTPS_PROXY set).
// The SDK's `ws` socket dials TLS directly; route it through the proxy instead.
// No effect on normal local or Vercel runs. Use with NODE_USE_ENV_PROXY=1 for fetch.
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const agent = new HttpsProxyAgent(proxy);
  const orig = https.request;
  https.request = function (opts, ...rest) {
    if (opts && typeof opts === "object" && opts.createConnection && !opts.agent) {
      delete opts.createConnection;
      opts.agent = agent;
    }
    return orig.call(this, opts, ...rest);
  };
}
