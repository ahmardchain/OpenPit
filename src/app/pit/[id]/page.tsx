import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPit } from "@/lib/pit-view";
import { PitClient } from "./pit-client";

export const dynamic = "force-dynamic";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pit = await loadPit(id);
  if (!pit) return {};
  const title = `${pit.market}-PERP pit · creator ${pit.side.toUpperCase()} · ${pit.status === "live" ? "LIVE" : "settled"}`;
  const img = `${APP}/api/og/${id}?v=${pit.status}-${pit.joins.length}`;
  return {
    title,
    description: pit.thesis || `Join Long or Fade with a real dreamDEX order. ${pit.durationMin} minutes, ${pit.capUsd} USDso cap.`,
    openGraph: { title, images: [img] },
    twitter: { card: "summary_large_image", title, images: [img] },
  };
}

export default async function PitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pit = await loadPit(id);
  if (!pit) notFound();
  return <PitClient initial={pit} appUrl={APP} />;
}
