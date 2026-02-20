"use client";

import { useEffect, useCallback } from "react";
import { Button } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Optional footer; if not provided, no footer. Use consistent button.secondary for Close. */
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
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
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
          {title ? (
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <Button variant="secondary" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
