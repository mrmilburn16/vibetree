"use client";

import { AlertCircle } from "lucide-react";

export function FailedIndicator({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 text-sm font-medium text-[var(--badge-error)] " +
        className
      }
    >
      <AlertCircle
        className="h-4 w-4 shrink-0"
        strokeWidth={2.5}
        aria-hidden
      />
      Failed
    </span>
  );
}
