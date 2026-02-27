"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background-primary)] px-4 text-center">
      <h1 className="text-4xl font-bold text-[var(--text-primary)]">Something went wrong</h1>
      <p className="mt-4 max-w-md text-[var(--text-secondary)]">
        An unexpected error occurred. Please try again, or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--button-primary-bg)] px-6 py-3 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
