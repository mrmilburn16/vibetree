"use client";

import { useEffect } from "react";

export type ToastVariant = "success" | "warning" | "error" | "info";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose: () => void;
  duration?: number;
  /** When true, Toast positions itself fixed at the bottom. False when used inside ToastProvider. */
  standalone?: boolean;
}

const variantBg: Record<ToastVariant, string> = {
  success: "bg-[var(--semantic-success)]/20 text-[var(--semantic-success)] border-[var(--semantic-success)]/40",
  warning: "bg-[var(--semantic-warning)]/20 text-[var(--semantic-warning)] border-[var(--semantic-warning)]/40",
  error: "bg-[var(--semantic-error)]/20 text-[var(--semantic-error)] border-[var(--semantic-error)]/40",
  info: "bg-[var(--semantic-info)]/20 text-[var(--semantic-info)] border-[var(--semantic-info)]/40",
};

export function Toast({
  message,
  variant = "info",
  onClose,
  duration = 5000,
  standalone = true,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  const positionClasses = standalone
    ? "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
    : "";

  return (
    <div
      className={`${positionClasses} rounded-lg border px-4 py-3 text-sm shadow-lg ${variantBg[variant]}`}
      role="alert"
    >
      {message}
    </div>
  );
}
