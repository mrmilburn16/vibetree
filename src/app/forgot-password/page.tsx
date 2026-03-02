"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { Button, Input, Card } from "@/components/ui";
import { getFirebaseAuth } from "@/lib/firebaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const trimmed = email.trim();
      if (!trimmed) {
        setError("Please enter your email.");
        setLoading(false);
        return;
      }
      const auth = getFirebaseAuth();
      if (!auth) {
        setError("Password reset is not configured. Set Firebase env vars.");
        setLoading(false);
        return;
      }
      await sendPasswordResetEmail(auth, trimmed);
      setSuccess(true);
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
      const message =
        code === "auth/user-not-found"
          ? "No account found with this email address."
          : err && typeof err === "object" && "message" in err
            ? (err as { message?: string }).message
            : "Something went wrong. Please try again.";
      setError(String(message));
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
          {success ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--semantic-success)]">
                Check your email for a reset link.
              </p>
              <Link href="/sign-in" className="text-sm text-[var(--link-default)] hover:text-[var(--link-hover)]">
                Back to sign in
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
          {!success && (
            <p className="text-body-muted mt-6 text-center text-sm">
              <Link href="/sign-in" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
                Back to sign in
              </Link>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
