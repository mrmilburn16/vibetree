"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { getFirebaseAuth, isFirebaseAuthEnabled } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isFirebaseAuthEnabled()) {
      setError("Password reset is only available when Firebase Auth is configured. Contact support.");
      return;
    }

    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Auth not configured");
      await sendPasswordResetEmail(auth, trimmed);
      setSent(true);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code === "auth/user-not-found"
          ? "No account found with this email."
          : (err as { message?: string }).message ?? "Something went wrong. Please try again."
        : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background-primary)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold text-[var(--text-primary)]">
            Vibetree
          </Link>
        </div>
        <Card className="p-8">
          <h1 className="text-heading-section mb-2">Reset password</h1>
          <p className="text-body-muted mb-6 text-sm">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--semantic-success)]">
                Check your email for a reset link. It may take a few minutes to arrive.
              </p>
              <Link href="/sign-in">
                <Button variant="primary" className="w-full">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-body-muted mb-1.5 block text-sm">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--semantic-error)]">{error}</p>
              )}
              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="text-body-muted mt-6 text-center text-sm">
            <Link href="/sign-in" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
              Back to sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
