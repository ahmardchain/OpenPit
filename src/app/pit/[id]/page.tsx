import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPit, who } from "@/lib/pit-view";
import { PitClientLoader } from "./pit-client-loader";
import { appUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pit = await loadPit(id);
  if (!pit) return {};
  const title = `${pit.market}-PERP pit by ${who({ mode: pit.mode, wallet: pit.creator })}, ${pit.status === "live" ? "open now" : "settled"}`;
  const img = `${await appUrl()}/api/og/${id}?v=${pit.status}-${pit.joins.length}`;
  return {
    title,
    description: pit.thesis || `${pit.side === "long" ? "Long" : "Short"} call on ${pit.market}-PERP for ${pit.durationMin} minutes. Join or fade it; the best return on the ${pit.capUsd} USDso cap wins.`,
    openGraph: { title, images: [img] },
    twitter: { card: "summary_large_image", title, images: [img] },
  };
}

export default async function PitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pit = await loadPit(id);
  if (!pit) notFound();
  return <PitClientLoader initial={pit} appUrl={await appUrl()} />;
}
