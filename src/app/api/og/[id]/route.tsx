import { ImageResponse } from "next/og";
import { q } from "@/lib/db";
import { toView } from "@/lib/pit-view";
import { fmtPct, fmtUsd, returnOnCapBps, sessionPnl } from "@/lib/scoring";
import { short } from "@/lib/chain";
import { readMark } from "@/lib/server-chain";

export const dynamic = "force-dynamic";

/** Shareable result card: live (mark + crowd split) or settled (winner + frozen mark). All numbers from the DB and chain. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = q.getPit(id);
  if (!row) return new Response("not found", { status: 404 });
  const pit = toView(row, q.joins(id));
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

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#09090b 0%,#1c1917 60%,#451a03 100%)", color: "#fafafa", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 36, height: 36, borderRadius: 10, background: "#f59e0b" }} />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>OpenPit</div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 24, padding: "6px 16px", borderRadius: 999, background: settled ? "#27272a" : "#f59e0b22", color: settled ? "#d4d4d8" : "#fcd34d" }}>{settled ? "SETTLED" : "● LIVE"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 36 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 900 }}>{`${pit.market}-PERP`}</div>
          <div style={{ display: "flex", fontSize: 34, padding: "6px 18px", borderRadius: 14, background: pit.side === "long" ? "#10b98133" : "#f43f5e33", color: pit.side === "long" ? "#6ee7b7" : "#fda4af" }}>{`creator ${pit.side.toUpperCase()}`}</div>
        </div>
        {pit.thesis && <div style={{ display: "flex", fontSize: 30, color: "#d4d4d8", marginTop: 10 }}>{`“${pit.thesis}”`}</div>}
        <div style={{ display: "flex", gap: 24, marginTop: "auto" }}>
          <Box label={settled ? "Frozen mark" : "Mark"} value={mark ? fmtUsd(mark) : "—"} />
          <Box label="Cap / trader" value={fmtUsd(capRaw, 0)} />
          <Box label="Long" value={String(longs)} color="#6ee7b7" />
          <Box label="Fade" value={String(shorts)} color="#fda4af" />
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 28, padding: "18px 24px", borderRadius: 18, background: "#ffffff0d", fontSize: 30 }}>
          {top ? (
            <>
              <span>{settled ? "Winner" : "Leading"}</span>
              <span style={{ marginLeft: 16, fontFamily: "monospace" }}>{short(top.wallet)}</span>
              <span style={{ marginLeft: 16, color: top.side === pit.side ? "#6ee7b7" : "#fda4af" }}>{top.side === pit.side ? top.side.toUpperCase() : "FADE"}</span>
              <span style={{ marginLeft: "auto", fontWeight: 800, color: top.roc >= 0 ? "#6ee7b7" : "#fda4af" }}>{`${fmtPct(top.roc)} return on cap`}</span>
            </>
          ) : (
            <span>No joins yet — be the first to fade.</span>
          )}
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 22, color: "#a1a1aa" }}>{`Real orders on dreamDEX perps · Somnia Hideki testnet · ${pit.durationMin}-minute pit`}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=15" } },
  );
}

function Box({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px 20px", borderRadius: 18, background: "#ffffff0d" }}>
      <div style={{ display: "flex", fontSize: 20, color: "#a1a1aa", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: color ?? "#fafafa" }}>{value}</div>
    </div>
  );
}
