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
        "inline-flex items-center gap-2 text-sm font-medium text-[var(--link-default)] " +
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
