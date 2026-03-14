"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Clock, User, FileText, AlertTriangle } from "lucide-react";

type FlagStatus = "pending" | "approved" | "denied";
type FilterTab = "pending" | "approved" | "denied" | "all";

interface FlaggedPrompt {
  id: string;
  userId: string;
  userEmail: string;
  projectId: string;
  prompt: string;
  flagReason: string;
  timestamp: number;
  reviewed: boolean;
  status: FlagStatus;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--badge-success)]/40 bg-[var(--badge-success)]/15 px-4 py-3 text-sm font-medium text-[var(--badge-success)] shadow-lg">
      <CheckCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

function FlagCard({
  item,
  onAction,
}: {
  item: FlaggedPrompt;
  onAction: (id: string, action: "approve" | "deny") => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);

  const handle = async (action: "approve" | "deny") => {
    setLoading(action);
    await onAction(item.id, action);
    setLoading(null);
  };

  const isPending = !item.reviewed || item.status === "pending";
  const statusColor =
    item.status === "approved"
      ? "text-[var(--badge-success)] border-[var(--badge-success)]/30 bg-[var(--badge-success)]/10"
      : item.status === "denied"
      ? "text-[var(--badge-error)] border-[var(--badge-error)]/30 bg-[var(--badge-error)]/10"
      : "text-[var(--text-secondary)] border-[var(--border-default)] bg-[var(--background-tertiary)]";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="font-medium text-[var(--text-secondary)]">{item.userEmail || item.userId}</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="font-mono">{item.projectId}</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimestamp(item.timestamp)}
            </span>
          </div>

          {/* Flag reason */}
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--badge-warning)]" />
            <span className="font-medium text-[var(--badge-warning)]">{item.flagReason || "No reason provided"}</span>
          </div>
        </div>

        {/* Status badge */}
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusColor}`}>
          {item.status}
        </span>
      </div>

      {/* Prompt text */}
      <div className="mt-3">
        <div
          className={`relative cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-tertiary)] p-3 text-sm text-[var(--text-primary)] ${
            !expanded ? "line-clamp-2" : ""
          }`}
          onClick={() => setExpanded(!expanded)}
        >
          {item.prompt}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Show full prompt
            </>
          )}
        </button>
      </div>

      {/* Action buttons — only show for pending items */}
      {isPending && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handle("approve")}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--badge-success)]/40 bg-[var(--badge-success)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--badge-success)] transition-colors hover:bg-[var(--badge-success)]/20 disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {loading === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handle("deny")}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--badge-error)]/40 bg-[var(--badge-error)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--badge-error)] transition-colors hover:bg-[var(--badge-error)]/20 disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            {loading === "deny" ? "Denying…" : "Deny"}
          </button>
        </div>
      )}
    </div>
  );
}

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "all", label: "All" },
];

export default function ModerationQueuePage() {
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [items, setItems] = useState<FlaggedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchItems = useCallback(async (tab: FilterTab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moderation?status=${tab}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/moderation/count");
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count ?? 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchItems(filter);
  }, [filter, fetchItems]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const handleAction = useCallback(
    async (id: string, action: "approve" | "deny") => {
      const res = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast(`Error: ${err.error ?? "Action failed"}`);
        return;
      }
      if (action === "deny") {
        setToast("Denied and refunded.");
      } else {
        setToast("Approved.");
      }
      // Optimistically update the item in place (update status / reviewed)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, reviewed: true, status: action === "approve" ? "approved" : "denied" }
            : item
        )
      );
      // Refresh count
      fetchCount();
    },
    [fetchCount]
  );

  return (
    <div className="min-h-screen bg-[var(--background-primary)] px-6 py-8">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Moderation Queue
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--badge-error)]/15 px-2 py-0.5 text-sm font-semibold text-[var(--badge-error)]">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Review flagged prompts and approve or deny them. Denied projects are disabled and the user receives a credit refund.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-1 w-fit">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.value
                  ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
              {tab.value === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-[var(--badge-error)] px-1.5 py-0.5 text-xs font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-[var(--background-secondary)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--badge-error)]/30 bg-[var(--badge-error)]/10 p-6 text-center text-sm text-[var(--badge-error)]">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-10 text-center">
            <CheckCircle className="mx-auto mb-3 h-8 w-8 text-[var(--badge-success)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {filter === "pending" ? "Nothing to review — queue is clear." : "No items in this category."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <FlagCard key={item.id} item={item} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
