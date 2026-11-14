"use client";
import dynamic from "next/dynamic";
import type { PitView } from "@/lib/pit-view";

// The live card (Reactivity watch) and the LONG / FADE buttons run on the dreamDEX SDK in the browser only.
const PitClient = dynamic(() => import("./pit-client").then((m) => m.PitClient), {
  ssr: false,
  loading: () => <div className="h-[560px] animate-pulse rounded-lg bg-surface" />,
});

export function PitClientLoader(props: { initial: PitView; appUrl: string }) {
  return <PitClient {...props} />;
}
