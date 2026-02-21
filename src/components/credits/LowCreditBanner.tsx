"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCredits } from "@/contexts/CreditsContext";

const BANNER_DISMISS_KEY = "vibetree-low-credits-banner-dismissed";

export function LowCreditBanner() {
  const { balance, isLow } = useCredits();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(BANNER_DISMISS_KEY) === "1");
  }, []);

  function handleDismiss() {
    sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!isLow || dismissed) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3 text-sm"
      role="alert"
    >
      <p className="text-[var(--text-primary)]">
        <span className="font-medium text-[var(--link-default)]">Running low on credits</span>
        {" — "}
        You have <strong>{balance} {balance === 1 ? "credit" : "credits"}</strong> left. Each message uses 1 credit.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/credits"
          className="rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-hover)]"
        >
          Buy credits
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss low credits alert"
          className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
