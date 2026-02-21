"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";

type BackgroundVariant = 1 | 2 | 3;

const LETTER_DELAY_MS = 350;
const WORD = "Vibetree";

function SignInLoadingWordmark() {
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCursorPosition((prev) => Math.min(prev + 1, WORD.length));
    }, LETTER_DELAY_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]" aria-hidden>
      {cursorPosition === 0 && (
        <span
          className="sign-in-cursor-blink inline-block h-[1em] w-2 align-baseline bg-[var(--text-primary)]"
          aria-hidden
        />
      )}
      {WORD.split("").map((char, i) => (
        <Fragment key={i}>
          {cursorPosition > i && (
            <span className="sign-in-typewriter-letter inline-block">{char}</span>
          )}
          {cursorPosition === i + 1 && (
            <span
              className="sign-in-cursor-blink ml-0.5 inline-block h-[1em] w-2 align-baseline bg-[var(--text-primary)]"
              aria-hidden
            />
          )}
        </Fragment>
      ))}
    </span>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backgroundVariant] = useState<BackgroundVariant>(2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Mock: accept any email/password and create session
      await new Promise((r) => setTimeout(r, 5000));
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
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={
        backgroundVariant === 1
          ? { background: "var(--background-primary)" }
          : { background: "var(--editor-pane-gradient)" }
      }
    >
      {/* Full-screen loading state */}
      {loading && (
        <div
          className="sign-in-loading-enter fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background-primary)]"
          style={{ background: "var(--editor-pane-gradient)" }}
          role="status"
          aria-live="polite"
          aria-label="Signing you in"
        >
          <div className="flex flex-col items-center gap-8">
            <div className="relative inline-flex items-baseline">
              <span className="sr-only">Vibetree</span>
              <SignInLoadingWordmark />
              <span
                className="sign-in-loading-glow absolute inset-0 -z-10 blur-xl"
                style={{
                  background: "radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb), 0.4), transparent 70%)",
                }}
                aria-hidden
              />
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">Signing you in</p>
            <div className="h-0.5 w-48 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
              <div
                className="sign-in-loading-bar h-full w-1/3 rounded-full bg-[var(--button-primary-bg)]"
                aria-hidden
              />
            </div>
          </div>
        </div>
      )}

      {/* Subtle bubbles (variant 3 only) */}
      {backgroundVariant === 3 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[
            { size: 200, left: "55%", top: "10%", delay: "0s" },
            { size: 140, left: "5%", top: "55%", delay: "3s" },
            { size: 100, left: "78%", top: "65%", delay: "1.5s" },
            { size: 70, left: "15%", top: "25%", delay: "4s" },
            { size: 55, left: "70%", top: "35%", delay: "2s" },
            { size: 45, left: "35%", top: "75%", delay: "5s" },
            { size: 38, left: "85%", top: "18%", delay: "0.5s" },
            { size: 32, left: "8%", top: "82%", delay: "3.5s" },
          ].map((b, i) => (
            <div
              key={i}
              className="animate-bubble-float absolute rounded-full border border-[var(--button-primary-bg)]/10 bg-[var(--button-primary-bg)]/5"
              style={{
                width: b.size,
                height: b.size,
                left: b.left,
                top: b.top,
                animationDelay: b.delay,
              }}
            />
          ))}
        </div>
      )}

<div className="relative z-10 w-full max-w-md">
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
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-body-muted text-sm">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--link-default)] hover:text-[var(--link-hover)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
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
