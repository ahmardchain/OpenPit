"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui";

// The form signs and sends orders through the dreamDEX SDK, so it renders in the browser only;
// keeping the SDK out of the server bundle keeps the Cloudflare Worker small.
const NewPitForm = dynamic(() => import("./new-pit-form"), { ssr: false, loading: () => <FormSkeleton /> });

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Open a pit</h1>
      <Card className="h-96 animate-pulse">{null}</Card>
    </div>
  );
}

export default function NewPit() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewPitForm />
    </Suspense>
  );
}
