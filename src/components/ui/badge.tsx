import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", {
  variants: {
    variant: {
      zinc: "border-line bg-surface-2 text-muted",
      green: "border-line bg-surface-2 text-long",
      red: "border-line bg-surface-2 text-fade",
      amber: "border-line bg-surface-2 text-accent",
      live: "border-accent bg-surface-2 text-accent",
    },
  },
  defaultVariants: { variant: "zinc" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
