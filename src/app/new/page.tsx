"use client";
import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DemoForm } from "./demo-form";

// The wallet form signs and sends orders through the dreamDEX SDK, so it loads in the browser only.
const WalletForm = dynamic(() => import("./new-pit-form"), { ssr: false, loading: () => <p className="text-sm text-muted">Loading wallet form</p> });

function NewPit() {
  const sp = useSearchParams();
  const wallet = sp.get("mode") === "wallet";
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Open a pit</h1>
        <p className="text-muted">
          Pick a market and a direction. Anyone with the link can join you or fade you until the bell, and the best return on the cap wins.
        </p>
      </div>
      {wallet ? (
        <>
          <WalletForm />
          <p className="border-t border-line pt-4 text-sm text-muted">
            No wallet? <Link href="/new" className="text-accent hover:underline">Open a paper pit instead</Link>.
          </p>
        </>
      ) : (
        <DemoForm />
      )}
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
