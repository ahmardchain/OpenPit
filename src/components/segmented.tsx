"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap self-start overflow-hidden rounded-md border border-line-strong bg-bg">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("h-9 border-r border-line px-3 text-[13px] text-muted last:border-r-0", on && "bg-accent text-white")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const fieldClass = "h-10 rounded-md border border-line-strong bg-bg px-3 outline-none focus:border-accent";
