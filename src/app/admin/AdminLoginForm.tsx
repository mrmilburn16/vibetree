"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid secret");
        return;
      }
      router.replace("/admin/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background-primary)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-8 shadow-xl">
        <h1 className="text-heading-section mb-2 text-center">Admin</h1>
        <p className="text-body-muted mb-6 text-center text-sm">
          Enter the admin secret to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Secret"
            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] placeholder-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]"
            autoFocus
            autoComplete="off"
          />
          {error && (
            <p className="text-caption text-[var(--semantic-error)]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--button-primary-bg)] px-4 py-3 font-medium text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)] disabled:opacity-50"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
