"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useCredits } from "@/contexts/CreditsContext";

/** Stacked coins — reads clearly as credits/currency */
const IconCoins = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="10" cy="14" r="6" />
    <circle cx="14" cy="10" r="6" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function CreditsWidget() {
  const { balance, isLow } = useCredits();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Credits balance and options"
        className={`
          flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium
          transition-colors
          ${isLow ? "border-[var(--link-default)]/50 bg-[color-mix(in_srgb,var(--button-primary-bg)_12%,var(--background-secondary))] text-[var(--link-default)]" : "border-[var(--border-default)] bg-[var(--background-secondary)] text-[var(--text-primary)] hover:bg-[var(--background-tertiary)]"}
        `}
      >
        <span className="flex items-center text-[var(--text-secondary)]" aria-hidden>
          <IconCoins />
        </span>
        <span>{balance}</span>
        <span className={isLow ? "text-[var(--link-default)]/80" : "text-[var(--text-tertiary)]"}>{balance === 1 ? "credit" : "credits"}</span>
        <span
          className={`inline-flex text-[var(--text-tertiary)] transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <IconChevronDown />
        </span>
      </button>

      <div
        aria-hidden={!open}
        className={`
          absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] py-2 shadow-lg
          transition-[opacity,transform] duration-200 ease-out
          ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none"}
        `}
        role="menu"
      >
          <div className="border-b border-[var(--border-default)] px-4 py-3">
            <p className="text-caption text-[var(--text-tertiary)]">Balance</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{balance} {balance === 1 ? "credit" : "credits"}</p>
            <p className="text-caption mt-0.5 text-xs text-[var(--text-tertiary)]">
              1 message = 1 credit
              <br />
              Resets monthly
            </p>
          </div>
          {isLow && (
            <div className="border-b border-[var(--border-default)] px-4 py-2">
              <p className="text-sm text-[var(--link-default)]">Running low on credits</p>
              <p className="text-caption text-xs text-[var(--text-tertiary)]">Buy more to keep building</p>
            </div>
          )}
          <div className="px-2 py-2">
            <Link
              href="/credits"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-3 py-2.5 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-hover)]"
            >
              Buy credits
            </Link>
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="mt-2 flex w-full items-center justify-center rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--link-default)]"
            >
              View plans
            </Link>
          </div>
        </div>
    </div>
  );
}
