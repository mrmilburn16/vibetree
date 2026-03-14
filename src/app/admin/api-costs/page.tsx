"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, Check, DollarSign, Loader2, Pencil, RefreshCw, TrendingUp, X } from "lucide-react";
import type { ApiMarketplaceEntry } from "@/lib/apiMarketplace";
import type { ProxyCallLogEntry } from "@/lib/proxyCallLog";

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatMoney(value: number | null, decimals = 4): string {
  if (value === null) return "—";
  if (value === 0) return "$0.00";
  const fixed = value.toFixed(decimals);
  // Trim trailing zeros after the decimal point but always show at least 2 places.
  // e.g. 0.0004 → "$0.0004", 0.12 → "$0.12", 0.1 → "$0.10"
  const [intPart, decPart = ""] = fixed.split(".");
  const trimmed = decPart.replace(/0+$/, "");
  const displayed = trimmed.length < 2 ? trimmed.padEnd(2, "0") : trimmed;
  return `$${intPart}.${displayed}`;
}

function formatMarkup(value: number | null): string {
  if (value === null) return "—";
  return `${value}%`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function marginColor(pct: number | null): string {
  if (pct === null) return "text-[var(--text-tertiary)]";
  if (pct >= 200) return "text-[var(--semantic-success)]";
  if (pct >= 50) return "text-[var(--text-secondary)]";
  if (pct >= 0) return "text-[var(--semantic-warning,#f59e0b)]";
  return "text-[var(--semantic-error,#ef4444)]";
}

// ── Inline price editor ───────────────────────────────────────────────────────

function PriceCell({
  entry,
  onSaved,
}: {
  entry: ApiMarketplaceEntry;
  onSaved: (updated: ApiMarketplaceEntry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditable = entry.userPricePerCallUsd !== null;

  function startEdit() {
    if (!isEditable) return;
    setDraft(
      entry.userPricePerCallUsd != null
        ? String(entry.userPricePerCallUsd)
        : ""
    );
    setError(null);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const parsed = parseFloat(draft);
    if (isNaN(parsed) || parsed < 0) {
      setError("Enter a valid non-negative number");
      return;
    }
    // Round to 4 decimal places to match display precision
    const value = Math.round(parsed * 10000) / 10000;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: entry.id, userPricePerCallUsd: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { entry?: ApiMarketplaceEntry };
      if (data.entry) onSaved(data.entry);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-1.5">
        <span className="text-[var(--text-secondary)]">
          {formatMoney(entry.userPricePerCallUsd)}
        </span>
        {isEditable && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit price for ${entry.name}`}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--link-default)] transition-opacity focus:opacity-100"
          >
            <Pencil className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-[var(--text-tertiary)] text-xs select-none">$</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.0001"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving}
          className="w-24 rounded border border-[var(--button-primary-bg)] bg-[var(--input-bg)] px-2 py-0.5 text-sm text-[var(--input-text)] focus:outline-none focus:ring-1 focus:ring-[var(--button-primary-bg)] disabled:opacity-60"
          aria-label="New price"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-label="Save price"
          className="rounded p-1 text-[var(--semantic-success)] hover:bg-[var(--semantic-success)]/10 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label="Cancel edit"
          className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {error && (
        <p className="text-xs text-[var(--semantic-error,#ef4444)]">{error}</p>
      )}
    </div>
  );
}

// ── Inline cost editor (Our cost per call) ────────────────────────────────────

function CostCell({
  entry,
  onSaved,
}: {
  entry: ApiMarketplaceEntry;
  onSaved: (updated: ApiMarketplaceEntry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Note-only entries (costPerCallUsd === null) are not editable
  const isEditable = entry.costPerCallUsd !== null;

  function startEdit() {
    if (!isEditable) return;
    setDraft(entry.costPerCallUsd != null ? String(entry.costPerCallUsd) : "");
    setError(null);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const parsed = parseFloat(draft);
    if (isNaN(parsed) || parsed < 0) {
      setError("Enter a valid non-negative number");
      return;
    }
    const value = Math.round(parsed * 10000) / 10000;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: entry.id, costPerCallUsd: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { entry?: ApiMarketplaceEntry };
      if (data.entry) onSaved(data.entry);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-1.5">
        <span className="text-[var(--text-secondary)]">
          {formatMoney(entry.costPerCallUsd)}
        </span>
        {isEditable && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit cost for ${entry.name}`}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--link-default)] transition-opacity focus:opacity-100"
          >
            <Pencil className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-[var(--text-tertiary)] text-xs select-none">$</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.0001"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving}
          className="w-24 rounded border border-[var(--button-primary-bg)] bg-[var(--input-bg)] px-2 py-0.5 text-sm text-[var(--input-text)] focus:outline-none focus:ring-1 focus:ring-[var(--button-primary-bg)] disabled:opacity-60"
          aria-label="New cost"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-label="Save cost"
          className="rounded p-1 text-[var(--semantic-success)] hover:bg-[var(--semantic-success)]/10 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label="Cancel edit"
          className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {error && (
        <p className="text-xs text-[var(--semantic-error,#ef4444)]">{error}</p>
      )}
    </div>
  );
}

// ── Inline daily free limit editor ───────────────────────────────────────────

function FreeLimitCell({
  entry,
  onSaved,
}: {
  entry: ApiMarketplaceEntry;
  onSaved: (updated: ApiMarketplaceEntry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Note-only entries (costPerCallUsd === null and userPricePerCallUsd === null) skip editing
  const isEditable = !(entry.costPerCallUsd === null && entry.userPricePerCallUsd === null);

  function startEdit() {
    if (!isEditable) return;
    setDraft(entry.dailyFreeLimit != null ? String(entry.dailyFreeLimit) : "");
    setError(null);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed))) {
      setError("Enter a non-negative whole number (or leave blank to remove)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: entry.id, dailyFreeLimit: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { entry?: ApiMarketplaceEntry };
      if (data.entry) onSaved(data.entry);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-1.5">
        <span className="text-[var(--text-secondary)]">
          {entry.dailyFreeLimit != null ? `${entry.dailyFreeLimit}/day` : "—"}
        </span>
        {isEditable && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit daily free limit for ${entry.name}`}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--link-default)] transition-opacity focus:opacity-100"
          >
            <Pencil className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving}
          placeholder="e.g. 10"
          className="w-20 rounded border border-[var(--button-primary-bg)] bg-[var(--input-bg)] px-2 py-0.5 text-sm text-[var(--input-text)] focus:outline-none focus:ring-1 focus:ring-[var(--button-primary-bg)] disabled:opacity-60"
          aria-label="Daily free calls"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-label="Save limit"
          className="rounded p-1 text-[var(--semantic-success)] hover:bg-[var(--semantic-success)]/10 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label="Cancel edit"
          className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {error && (
        <p className="text-xs text-[var(--semantic-error,#ef4444)]">{error}</p>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type LogTotals = {
  totalActualCostUsd: number;
  totalChargedUsd: number;
  overallMarginPercent: number | null;
  entryCount: number;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminApiCostsPage() {
  const [entries, setEntries] = useState<ApiMarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [logEntries, setLogEntries] = useState<ProxyCallLogEntry[]>([]);
  const [logTotals, setLogTotals] = useState<LogTotals | null>(null);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-marketplace", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as { entries?: ApiMarketplaceEntry[] };
      setEntries(data.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    setLogError(null);
    try {
      const res = await fetch("/api/admin/proxy-call-log", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { entries?: ProxyCallLogEntry[]; totals?: LogTotals };
      setLogEntries(data.entries ?? []);
      setLogTotals(data.totals ?? null);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to load log");
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchLog();
  }, [fetchEntries, fetchLog]);

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
      const data = await res.json() as { entries?: ApiMarketplaceEntry[] };
      if (data.entries) setEntries(data.entries);
    } catch {
      // leave state unchanged
    } finally {
      setTogglingId(null);
    }
  };

  const handlePriceSaved = useCallback((updated: ApiMarketplaceEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  const handleCostSaved = useCallback((updated: ApiMarketplaceEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  const handleFreeLimitSaved = useCallback((updated: ApiMarketplaceEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background-primary)] p-4 lg:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
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
              Proxy costs, user pricing, and enabled state. Prices are saved to Firestore and reflected on{" "}
              <Link href="/pricing/apis" className="text-[var(--link-default)] hover:underline">
                /pricing/apis
              </Link>{" "}
              instantly.
            </p>
          </div>
        </div>

        {/* ── Registry Table ── */}
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
                    <span className="ml-1.5 text-xs font-normal text-[var(--text-tertiary)]">
                      (click to edit)
                    </span>
                  </th>
                  <th className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    User price per call
                    <span className="ml-1.5 text-xs font-normal text-[var(--text-tertiary)]">
                      (click to edit)
                    </span>
                  </th>
                  <th className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    Markup %
                  </th>
                  <th className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    Daily free calls
                    <span className="ml-1.5 text-xs font-normal text-[var(--text-tertiary)]">
                      (click to edit)
                    </span>
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
                    <td className="px-4 py-3">
                      <CostCell entry={entry} onSaved={handleCostSaved} />
                    </td>
                    <td className="px-4 py-3">
                      <PriceCell entry={entry} onSaved={handlePriceSaved} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatMarkup(entry.markupPercent)}
                    </td>
                    <td className="px-4 py-3">
                      <FreeLimitCell entry={entry} onSaved={handleFreeLimitSaved} />
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
          Prices are persisted to Firestore (collection: <code>api_marketplace</code>) and merged with
          code defaults at request time. Toggle controls whether the API appears on the public pricing page.
        </p>

        {/* ── Live Cost Log ── */}
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-primary-bg)]/20 text-[var(--link-default)]">
                <TrendingUp className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Live Cost Log
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Most recent 50 proxy calls — actual Anthropic / API cost vs. what we charged.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchLog}
              disabled={logLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${logLoading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          </div>

          {/* Totals bar */}
          {logTotals && !logLoading && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3">
                <div className="text-xs text-[var(--text-tertiary)]">Total actual cost</div>
                <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                  {formatMoney(logTotals.totalActualCostUsd, 4)}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3">
                <div className="text-xs text-[var(--text-tertiary)]">Total charged</div>
                <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                  {formatMoney(logTotals.totalChargedUsd, 4)}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3">
                <div className="text-xs text-[var(--text-tertiary)]">Overall margin</div>
                <div className={`mt-1 text-lg font-semibold ${marginColor(logTotals.overallMarginPercent)}`}>
                  {formatMarkup(logTotals.overallMarginPercent)}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3">
                <div className="text-xs text-[var(--text-tertiary)]">Calls shown</div>
                <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                  {logTotals.entryCount}
                </div>
              </div>
            </div>
          )}

          {logLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] py-16 text-[var(--text-secondary)]">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span>Loading log…</span>
            </div>
          ) : logError ? (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
              <p className="text-[var(--semantic-error,#ef4444)]">Error: {logError}</p>
              <button
                type="button"
                onClick={fetchLog}
                className="mt-3 text-[var(--link-default)] hover:underline"
              >
                Retry
              </button>
            </div>
          ) : logEntries.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-16 text-center text-sm text-[var(--text-secondary)]">
              No proxy calls logged yet. Calls to /api/proxy/ai and /api/proxy/places will appear here.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] bg-[var(--background-tertiary)]">
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-[var(--text-primary)]">
                        Timestamp
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-[var(--text-primary)]">
                        Endpoint
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-[var(--text-primary)]">
                        Actual cost
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-[var(--text-primary)]">
                        Charged
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-[var(--text-primary)]">
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--background-tertiary)]/40"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--text-tertiary)]">
                          {formatTimestamp(entry.timestamp)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
                            /api/proxy/{entry.endpoint}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {formatMoney(entry.actualCostUsd, 5)}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {formatMoney(entry.chargedUsd, 3)}
                          {entry.chargedCredits > 0 && (
                            <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">
                              ({entry.chargedCredits} cr)
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 font-medium ${marginColor(entry.marginPercent)}`}>
                          {formatMarkup(entry.marginPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            Logged per call to Firestore (proxy_call_logs). AI cost computed from Anthropic token usage at $3/MTok input + $15/MTok output. Places cost is $0 (Apple MapKit free tier).
          </p>
        </div>
      </div>
    </div>
  );
}
