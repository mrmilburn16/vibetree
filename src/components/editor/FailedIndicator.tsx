"use client";

import { AlertCircle } from "lucide-react";

export function FailedIndicator({
  className = "",
  reason,
}: {
  className?: string;
  /** Optional failure reason to show next to "Failed" (e.g. from LLM or build). */
  reason?: string | null;
}) {
  const label = reason && reason.trim() ? `Failed: ${reason.trim()}` : "Failed";
  return (
    <span
      className={
        "inline-flex items-center gap-2 text-sm font-medium text-[var(--badge-error)] " +
        className
      }
      title={reason && reason.trim() ? reason.trim() : undefined}
    >
      <AlertCircle
        className="h-4 w-4 shrink-0"
        strokeWidth={2.5}
        aria-hidden
      />
      <span className="min-w-0 truncate max-w-[240px] sm:max-w-[320px]">{label}</span>
    </span>
  );
}
