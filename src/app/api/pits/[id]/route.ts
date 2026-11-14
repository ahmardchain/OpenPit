import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { toView } from "@/lib/pit-view";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pit = q.getPit(id);
  if (!pit) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ pit: toView(pit, q.joins(id)) });
}
