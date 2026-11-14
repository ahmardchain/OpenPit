import { ImageResponse } from "next/og";
import { loadPit, who } from "@/lib/pit-view";
import { fmtPct, fmtUsd, returnOnCapBps, sessionPnl } from "@/lib/scoring";
import { readMark } from "@/lib/server-chain";

export const dynamic = "force-dynamic";

/** Shareable result card: live (mark + crowd split) or settled (winner + frozen mark). All numbers from the DB and chain. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pit = await loadPit(id);
  if (!pit) return new Response("not found", { status: 404 });
  const capRaw = BigInt(Math.round(pit.capUsd * 1e6)) * 10n ** 12n;
  let mark: bigint | null = pit.endMark ? BigInt(pit.endMark) : null;
  if (!mark) {
    const m = await readMark(pit.pool).catch(() => ({ ok: false, price: 0n }));
    mark = m.ok ? m.price : null;
  }
  const scored = pit.joins
    .map((j) => {
      const pnl = j.finalPnl !== null ? BigInt(j.finalPnl) : mark ? sessionPnl(j.side, BigInt(j.qty), BigInt(j.entry), mark, pit.baseDecimals) : 0n;
      return { ...j, pnl, roc: j.finalRocBps ?? returnOnCapBps(pnl, capRaw) };
    })
    .sort((a, b) => b.roc - a.roc);
  const longs = pit.joins.filter((j) => j.side === "long").length;
  const shorts = pit.joins.length - longs;
  const top = scored[0];
  const settled = pit.status === "settled";

  const sideColor = pit.side === "long" ? "#1BBF7A" : "#E5484D";
  const topSideColor = top?.side === "long" ? "#1BBF7A" : "#E5484D";
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: "#0B0C0F", color: "#EDECE7", padding: "48px 56px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg viewBox="0 0 64 64" width={36} height={36}>
            <rect width="64" height="64" rx="10" fill="#1F5EFF" />
            <circle cx="32" cy="34" r="17" fill="none" stroke="#ffffff" strokeWidth="5" />
            <rect x="28.5" y="8" width="7" height="12" rx="2" fill="#ffffff" />
            <path d="M32 24 L32 44" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
            <path d="M23 40 L32 24" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
            <path d="M41 40 L32 24" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>OpenPit</div>
          <div style={{ display: "flex", marginLeft: "auto" }}>
            {settled ? (
              <div style={{ display: "flex", fontSize: 18, letterSpacing: 1.4, textTransform: "uppercase", color: "#8B8E99", border: "1px solid #23262F", borderRadius: 999, padding: "6px 12px" }}>Settled</div>
            ) : (
              <div style={{ display: "flex", fontSize: 18, letterSpacing: 1.4, textTransform: "uppercase", color: "#1BBF7A", border: "1px solid rgba(27,191,122,0.35)", borderRadius: 999, padding: "6px 12px" }}>Live</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 28 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 600, letterSpacing: -2, lineHeight: 1 }}>{`${pit.market}-PERP`}</div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 1, textTransform: "uppercase", color: sideColor, border: `1px solid ${sideColor}`, borderRadius: 6, padding: "6px 12px" }}>{`creator ${pit.side === "long" ? "Long" : "Short"}`}</div>
        </div>
        {pit.thesis ? <div style={{ display: "flex", fontSize: 26, color: "#8B8E99", marginTop: 14 }}>{`“${pit.thesis}”`}</div> : <div style={{ display: "flex" }} />}
        <div style={{ display: "flex", marginTop: "auto", borderTop: "1px solid #23262F", paddingTop: 22 }}>
          <Metric label={settled ? "Frozen mark" : "Mark"} value={mark ? fmtUsd(mark) : "—"} />
          <Metric label="Cap / trader" value={fmtUsd(capRaw, 0)} />
          <Metric label="Long" value={String(longs)} color="#1BBF7A" />
          <Metric label="Short" value={String(shorts)} color="#E5484D" />
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 18, borderTop: "1px solid #23262F", paddingTop: 18, fontSize: 28 }}>
          {top ? (
            <>
              <span style={{ color: "#8B8E99", fontSize: 16, letterSpacing: 1.4, textTransform: "uppercase" }}>{settled ? "Winner" : "Leading"}</span>
              <span style={{ marginLeft: 16 }}>{who(top)}</span>
              <span style={{ marginLeft: 16, color: topSideColor }}>{top.side === "long" ? "Long" : "Short"}</span>
              <span style={{ marginLeft: "auto", fontWeight: 600, color: top.roc >= 0 ? "#1BBF7A" : "#E5484D" }}>{`${fmtPct(top.roc)} on cap`}</span>
            </>
          ) : (
            <span style={{ color: "#8B8E99" }}>No joins yet. Be the first to fade.</span>
          )}
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 18, color: "#8B8E99" }}>{`${pit.mode === "demo" ? "Paper positions at live dreamDEX prices" : "Real orders on dreamDEX perps"}, Somnia Hideki testnet, ${pit.durationMin}-minute pit`}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=15" } },
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 24 }}>
      <div style={{ display: "flex", fontSize: 16, letterSpacing: 1.4, textTransform: "uppercase", color: "#8B8E99" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 36, fontWeight: 500, marginTop: 6, color: color ?? "#EDECE7" }}>{value}</div>
    </div>
  );
}
