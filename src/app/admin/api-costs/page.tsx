"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, DollarSign, Loader2 } from "lucide-react";
import type { ApiMarketplaceEntry } from "@/lib/apiMarketplace";

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0.00";
  return `$${value.toFixed(3)}`;
}

function formatMarkup(value: number | null): string {
  if (value === null) return "—";
  return `${value}%`;
}

export default function AdminApiCostsPage() {
  const [entries, setEntries] = useState<ApiMarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-marketplace", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch("/api/admin/api-marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, enabled: !currentEnabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      if (data.entry) {
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? data.entry : e))
        );
      }
    } catch {
      // leave state unchanged
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-primary)] p-4 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--link-default)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Admin
          </Link>
          <Link
            href="/pricing/apis"
            className="text-sm text-[var(--link-default)] hover:underline"
          >
            View public page →
          </Link>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-primary-bg)]/20 text-[var(--link-default)]">
            <DollarSign className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              API Marketplace
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Proxy costs, user pricing, and enabled state. Generated apps call{" "}
              <code className="rounded bg-[var(--background-tertiary)] px-1 py-0.5 font-mono text-xs">
                /api/proxy/[service]
              </code>
              .
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] py-16 text-[var(--text-secondary)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>Loading…</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)]">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--background-tertiary)]">
                  <th className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    API name & category
                  </th>
                  <th className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    Our cost per call
                  </th>
                  <th className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    User price per call
                  </th>
                  <th className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    Markup %
                  </th>
                  <th className="w-[120px] px-4 py-3 font-medium text-[var(--text-primary)]">
                    Enabled
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">
                        {entry.name}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {entry.category}
                      </div>
                      {entry.note && (
                        <div className="mt-0.5 text-xs text-[var(--text-tertiary)] italic">
                          {entry.note}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatMoney(entry.costPerCallUsd)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatMoney(entry.userPricePerCallUsd)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatMarkup(entry.markupPercent)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={togglingId === entry.id}
                        onClick={() => handleToggle(entry.id, entry.enabled)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          entry.enabled
                            ? "bg-[var(--badge-live)]/20 text-[var(--semantic-success)]"
                            : "bg-[var(--background-tertiary)] text-[var(--text-tertiary)]"
                        } ${togglingId === entry.id ? "opacity-60" : "hover:opacity-90"}`}
                        aria-pressed={entry.enabled}
                        aria-label={entry.enabled ? "Disable" : "Enable"}
                      >
                        {togglingId === entry.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : null}
                        {entry.enabled ? "On" : "Off"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          Proxy scaffold: requests to <code className="rounded bg-[var(--background-tertiary)] px-1 py-0.5">/api/proxy/[service]</code> resolve
          against this registry. Real API keys are not wired yet; the route returns a placeholder until implemented.
        </p>
      </div>
    </div>
  );
}
