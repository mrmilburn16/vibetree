"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";

export default function SignInPage() {
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
      // Mock: accept any email/password and create session
      await new Promise((r) => setTimeout(r, 600));
      if (password.length < 1) {
        setError("Please enter your password.");
        setLoading(false);
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("vibetree-session", JSON.stringify({ email, at: Date.now() }));
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
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
          <h1 className="text-heading-section mb-2">Sign in</h1>
          <p className="text-body-muted mb-6 text-sm">
            Build and ship iOS apps with AI. Sign in to continue.
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--semantic-error)]">{error}</p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-body-muted mt-6 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
              Sign up
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
