import { NextResponse } from "next/server";
import { loadPit } from "@/lib/pit-view";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pit = await loadPit(id);
  if (!pit) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ pit });
}
