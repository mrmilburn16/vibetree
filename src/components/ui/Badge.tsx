import { type HTMLAttributes } from "react";

export type BadgeVariant = "live" | "building" | "error" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  live: "bg-[var(--badge-live)]/20 text-[var(--badge-live)]",
  building: "bg-[var(--badge-building)]/20 text-[var(--badge-building)]",
  error: "bg-[var(--badge-error)]/20 text-[var(--badge-error)]",
  neutral: "bg-[var(--badge-neutral)]/20 text-[var(--badge-neutral)]",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}
