"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { FontSwitcher } from "@/components/FontSwitcher";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--background-primary)]/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
        >
          Vibetree
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <FontSwitcher />
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
