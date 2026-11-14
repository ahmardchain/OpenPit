"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DemoForm } from "./demo-form";

// The wallet form signs and sends orders through the dreamDEX SDK, so it loads in the browser only.
const WalletForm = dynamic(() => import("./new-pit-form"), { ssr: false, loading: () => <p className="text-sm text-muted">Loading wallet form</p> });

function NewPit() {
  const sp = useSearchParams();
  const wallet = sp.get("mode") === "wallet";
  return (
    <div>
      <div className="mb-7 max-w-xl space-y-2">
        <h1 className="text-4xl font-semibold">Open a pit</h1>
        <p className="text-muted">Pick a market and a direction. Anyone with the link can join you or fade you until the bell, and the best return on the cap wins.</p>
      </div>
      {wallet ? <WalletForm /> : <DemoForm />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewPit />
    </Suspense>
  );
}
