import { type HTMLAttributes } from "react";

export function BetaBadge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={
        "inline-flex items-center rounded-md border border-[var(--border-default)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] " +
        className
      }
      aria-label="Beta"
      {...props}
    >
      Beta
    </span>
  );
}
