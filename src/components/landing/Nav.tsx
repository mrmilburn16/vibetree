"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
type SessionUser = { uid: string; email: string | null } | null;

export function Nav() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.ok ? res.json() : {})
      .then((data: { user?: SessionUser }) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function handleSignOut(e: React.MouseEvent) {
    e.preventDefault();
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    setUser(null);
    router.push("/waitlist");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--background-primary)]/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/waitlist"
            className="text-xl font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
          >
            Vibetree
          </Link>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
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
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Button variant="primary" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="primary">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
