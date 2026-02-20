"use client";

import { CheckCircle } from "lucide-react";

export function ReadyIndicator({
  label = "Ready",
  className = "",
}: {
  label?: "Ready" | "LIVE";
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium " +
        "border-[var(--button-primary-bg)]/40 bg-[var(--button-primary-bg)]/10 text-[var(--link-default)] " +
        "animate-building-glow " +
        className
      }
    >
      <CheckCircle
        className="h-4 w-4 shrink-0"
        strokeWidth={2.5}
        aria-hidden
      />
      {label}
    </span>
  );
}
