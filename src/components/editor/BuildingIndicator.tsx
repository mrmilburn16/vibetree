"use client";

import { Loader2 } from "lucide-react";

export function BuildingIndicator({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium " +
        "border-[var(--button-primary-bg)]/40 bg-[var(--button-primary-bg)]/10 text-[var(--link-default)] " +
        "animate-building-glow " +
        className
      }
    >
      <Loader2
        className="h-4 w-4 shrink-0 animate-spin"
        strokeWidth={2.5}
        aria-hidden
      />
      Building…
    </span>
  );
}
