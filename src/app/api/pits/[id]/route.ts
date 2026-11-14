import { NextResponse } from "next/server";
import { loadPit } from "@/lib/pit-view";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const pit = await loadPit(id);
    if (!pit) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ pit });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read this pit.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
