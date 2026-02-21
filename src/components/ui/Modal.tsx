"use client";

import { useEffect, useCallback } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Optional footer; if not provided, no footer. Use consistent button.secondary for Close. */
  footer?: React.ReactNode;
  /** Optional class for the dialog box (e.g. max-w-sm for a narrower modal). */
  dialogClassName?: string;
  /** Optional class for the footer container (e.g. justify-center to center buttons). */
  footerClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, dialogClassName = "", footerClassName = "" }: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] shadow-xl ${dialogClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-end border-b border-[var(--border-default)] px-6 py-4">
          {title ? (
            <h2 className="absolute left-0 right-0 text-center text-lg font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="relative z-10 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className={`flex gap-2 border-t border-[var(--border-default)] px-6 py-4 ${footerClassName || "justify-end"}`.trim()}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
