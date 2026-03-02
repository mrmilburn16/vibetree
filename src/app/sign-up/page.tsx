"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Button, Input, Card } from "@/components/ui";
import { getFirebaseAuth } from "@/lib/firebaseClient";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }
      const auth = getFirebaseAuth();
      if (!auth) {
        setError("Sign-up is not configured. Set Firebase env vars.");
        setLoading(false);
        return;
      }
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Sign-up failed.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code === "auth/email-already-in-use"
          ? "This email is already in use. Sign in instead."
          : (err as { message?: string }).message ?? "Something went wrong. Please try again."
        : "Something went wrong. Please try again.";
      setError(message);
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
          <h1 className="text-heading-section mb-2">Create an account</h1>
          <p className="text-body-muted mb-6 text-sm">
            Build and ship iOS apps with AI. Sign up to get started.
          </p>
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
            <div>
              <label htmlFor="password" className="text-body-muted mb-1.5 block text-sm">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--semantic-error)]">{error}</p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </Button>
          </form>
          <p className="text-body-muted mt-6 text-center text-sm">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
              Sign in
            </Link>
          </p>
          <p className="text-caption mt-4 text-center">
            <Link href="/terms" className="text-[var(--link-default)]">Terms</Link>
            {" · "}
            <Link href="/privacy" className="text-[var(--link-default)]">Privacy</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
