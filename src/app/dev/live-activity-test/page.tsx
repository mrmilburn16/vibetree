"use client";

import { useState } from "react";
import Link from "next/link";

export default function LiveActivityTestPage() {
  const [projectName, setProjectName] = useState("Simulated Build");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/build-jobs/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: projectName.trim() || "Simulated Build" }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(data.message ?? "Simulation started.");
      } else {
        setMessage(data.error ?? "Request failed.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background-primary)] text-[var(--text-primary)] p-6">
      <div className="max-w-md mx-auto space-y-6">
        <Link
          href="/docs"
          className="text-sm text-[var(--link-default)] hover:underline"
        >
          ← Back to docs
        </Link>
        <h1 className="text-2xl font-bold">Test Live Activity</h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Start a simulated build so your VibeTree Companion app can show a Live Activity on the lock screen or Dynamic Island. Open the companion app, then click below and lock your phone.
        </p>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Project name (optional)
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Simulated Build"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)]"
          />
        </div>
        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)] disabled:opacity-50"
        >
          {loading ? "Starting…" : "Simulate build (90s)"}
        </button>
        {message && (
          <p className="text-sm text-[var(--text-secondary)] p-3 rounded-lg bg-[var(--background-secondary)]">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
