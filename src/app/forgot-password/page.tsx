"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background-primary)] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-[var(--text-primary)]">
          Reset password
        </h1>

        {submitted ? (
          <div className="mt-6 text-center">
            <p className="text-[var(--text-secondary)]">
              If an account with that email exists, we&apos;ve sent a reset link. Check your inbox.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-block text-sm text-[var(--link-default)] hover:text-[var(--link-hover)]"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-[var(--text-secondary)]">
              Enter your email and we&apos;ll send a password reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Email
                </label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--semantic-error)]" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-[var(--text-tertiary)]">
              <Link href="/sign-in" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
