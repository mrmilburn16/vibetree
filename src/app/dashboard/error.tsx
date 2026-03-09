"use client";

/**
 * Catches errors in the dashboard route (e.g. module load or render).
 * Check browser console for [dashboard:error] to see what threw.
 */
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard:error]", error?.message, error?.digest, error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background-primary)] px-4">
      <h1 className="text-heading-section">Something went wrong</h1>
      <p className="text-body-muted max-w-md text-center">
        The dashboard failed to load. Check the browser console for [dashboard:error] and the Next.js terminal for server errors.
      </p>
      <pre className="max-h-32 overflow-auto rounded bg-[var(--background-secondary)] p-3 text-xs text-[var(--text-secondary)]">
        {error?.message}
      </pre>
      <div className="flex gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/sign-in">
          <Button variant="secondary">Sign in</Button>
        </Link>
      </div>
    </div>
  );
}
