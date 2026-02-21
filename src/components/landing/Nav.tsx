"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export function Nav() {
  const pathname = usePathname();
  const isWaitlist = pathname === "/waitlist";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--background-primary)]/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xl font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
          >
            Vibetree
          </Link>
          <span
            className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] p-0.5 text-sm"
            role="tablist"
            aria-label="Landing view"
          >
            <Link
              href="/"
              role="tab"
              aria-selected={!isWaitlist}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                !isWaitlist
                  ? "bg-[var(--background-tertiary)] font-medium text-[var(--link-default)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Product
            </Link>
            <Link
              href="/waitlist"
              role="tab"
              aria-selected={isWaitlist}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                isWaitlist
                  ? "bg-[var(--background-tertiary)] font-medium text-[var(--link-default)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Waitlist
            </Link>
          </span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <ThemeSwitcher />
          <Link
            href="/#features"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
          >
            How it works
          </Link>
                    <Link
            href="/pricing"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
          >
            Pricing
          </Link>
          <Link
            href="/contact"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
          >
            Contact
          </Link>
          <Link href="/sign-in">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="primary">Get started</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
