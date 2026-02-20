"use client";

import { Loader2 } from "lucide-react";

export function BuildingIndicator({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 text-sm font-medium text-[var(--link-default)] " +
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
