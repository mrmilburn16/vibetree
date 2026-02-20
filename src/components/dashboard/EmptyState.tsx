"use client";

import { Button, Card } from "@/components/ui";

/** Abstract app/phone shape using only strokes — no new colors, theme only */
function EmptyIllustration() {
  return (
    <div className="mx-auto w-40 text-[var(--text-tertiary)] opacity-50">
      <svg viewBox="0 0 120 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full">
        <rect x="25" y="10" width="70" height="120" rx="8" />
        <path d="M50 5h20v10H50z" />
        <circle cx="60" cy="50" r="12" />
        <path d="M40 75h40M40 88h32M40 101h24" />
      </svg>
    </div>
  );
}

interface EmptyStateProps {
  onCreateFirst: () => void;
}

export function EmptyState({ onCreateFirst }: EmptyStateProps) {
  return (
    <div className="animate-fade-in mx-auto max-w-md">
      <Card
        className="flex flex-col items-center py-14 text-center"
        style={{
          background: "linear-gradient(180deg, var(--background-secondary) 0%, var(--background-tertiary) 100%)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <EmptyIllustration />
        <h2 className="text-heading-card mt-6 mb-1">Create your first app</h2>
        <p className="text-body-muted mb-8 text-sm">
          Describe what you want in plain language. AI writes Swift, you preview live, then ship to your iPhone or the App Store.
        </p>
        <ol className="text-body-muted mb-8 flex flex-wrap justify-center gap-6 text-left text-sm">
          <li className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--button-primary-bg)]/15 text-xs font-semibold text-[var(--link-default)]">1</span>
            Create an app
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--button-primary-bg)]/15 text-xs font-semibold text-[var(--link-default)]">2</span>
            Describe in chat
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--button-primary-bg)]/15 text-xs font-semibold text-[var(--link-default)]">3</span>
            Ship to device or App Store
          </li>
        </ol>
        <Button variant="primary" onClick={onCreateFirst} className="animate-cta-pulse min-w-[200px]">
          Create your first app
        </Button>
      </Card>
    </div>
  );
}
