"use client";

import Link from "next/link";
import { useCredits } from "@/contexts/CreditsContext";

export function LowCreditBanner() {
  const { balance, isLow } = useCredits();

  if (!isLow) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--semantic-warning)]/30 bg-[var(--semantic-warning)]/10 px-4 py-3 text-sm"
      role="alert"
    >
      <p className="text-[var(--text-primary)]">
        <span className="font-medium text-[var(--semantic-warning)]">Running low on credits</span>
        {" — "}
        You have <strong>{balance} credits</strong> left. Each message uses 1 credit.
      </p>
      <Link
        href="/credits"
        className="shrink-0 rounded-[var(--radius-md)] bg-[var(--semantic-warning)]/20 px-4 py-2 text-sm font-medium text-[var(--semantic-warning)] transition-colors hover:bg-[var(--semantic-warning)]/30"
      >
        Buy credits
      </Link>
    </div>
  );
}
