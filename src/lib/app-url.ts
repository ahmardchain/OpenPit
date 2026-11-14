import { headers } from "next/headers";

/** Public base URL for share links and OG images: NEXT_PUBLIC_APP_URL if set, otherwise the request's own host. */
export async function appUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
