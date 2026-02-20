"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]",
  secondary:
    "bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]",
  ghost:
    "bg-transparent text-[var(--button-ghost-text)] hover:text-[var(--text-primary)]",
  destructive:
    "bg-[var(--button-destructive-bg)] text-[var(--button-destructive-text)] hover:bg-[var(--button-secondary-hover)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)]
          px-4 py-2.5 min-h-[40px] text-sm font-medium
          transition-all duration-[var(--transition-normal)] ease-out
          hover:scale-[1.02] active:scale-[0.98]
          disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100 disabled:active:scale-100
          ${variantClasses[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
