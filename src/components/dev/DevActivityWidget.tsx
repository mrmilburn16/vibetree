"use client";

import { useState, useEffect, useCallback } from "react";
import { GitBranch, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

type ActivityData = {
  modified: string[];
  added: string[];
  deleted: string[];
  total: number;
};

export function DevActivityWidget() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/activity");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const id = setInterval(fetchActivity, 2500);
    return () => clearInterval(id);
  }, [fetchActivity]);

  const refreshPage = () => window.location.reload();

  if (loading || !data || data.total === 0) return null;

  const allFiles = [
    ...data.modified.map((f) => ({ path: f, type: "modified" as const })),
    ...data.added.map((f) => ({ path: f, type: "added" as const })),
    ...data.deleted.map((f) => ({ path: f, type: "deleted" as const })),
  ];

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2"
      aria-label="Dev activity: uncommitted changes"
    >
      <div
        className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] shadow-lg"
        style={{ minWidth: expanded ? 320 : "auto" }}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--background-tertiary)]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--button-primary-bg)]/20">
            <GitBranch className="h-4 w-4 text-[var(--link-default)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {data.total} file{data.total !== 1 ? "s" : ""} changed
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Uncommitted • updates every 2.5s</p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
          )}
        </button>

        {/* Expanded file list */}
        {expanded && (
          <div className="max-h-64 overflow-y-auto border-t border-[var(--border-default)]">
            <ul className="divide-y divide-[var(--border-default)] py-1">
              {allFiles.slice(0, 20).map(({ path, type }) => (
                <li key={path} className="px-4 py-1.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      type === "added"
                        ? "bg-[var(--semantic-success)]"
                        : type === "deleted"
                          ? "bg-[var(--semantic-error)]"
                          : "bg-[var(--semantic-warning)]"
                    }`}
                    aria-hidden
                  />
                  <span className="font-mono text-xs text-[var(--text-secondary)] break-all">
                    {path}
                  </span>
                </li>
              ))}
            </ul>
            {allFiles.length > 20 && (
              <p className="px-4 py-2 text-xs text-[var(--text-tertiary)]">
                +{allFiles.length - 20} more
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t border-[var(--border-default)] p-2">
          <button
            type="button"
            onClick={refreshPage}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh page
          </button>
        </div>
      </div>
    </div>
  );
}
