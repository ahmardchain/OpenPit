"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/segmented";

/** Paper is the default. Wallet mode keeps the same query (market, rematch, …) and adds mode=wallet. */
export function ModeField() {
  const sp = useSearchParams();
  const router = useRouter();
  const wallet = sp.get("mode") === "wallet";
  return (
    <div className="mb-[22px] flex flex-col gap-2">
      <span className="label">Mode</span>
      <Segmented
        label="Mode"
        value={wallet ? "wallet" : "paper"}
        onChange={(next) => {
          const params = new URLSearchParams(sp.toString());
          if (next === "wallet") params.set("mode", "wallet");
          else params.delete("mode");
          const q = params.toString();
          router.replace(q ? `/new?${q}` : "/new");
        }}
        options={[
          { value: "paper", label: "Paper" },
          { value: "wallet", label: "Wallet order" },
        ]}
      />
    </div>
  );
}
