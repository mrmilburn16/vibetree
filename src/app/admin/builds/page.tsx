"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Sparkles,
  Wrench,
  FileCode2,
  Clock,
  RefreshCw,
  ArrowLeft,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { Button, DropdownSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

type BuildResult = {
  id: string;
  timestamp: string;
  projectId: string;
  projectName: string;
  prompt: string;
  tier: string;
  category: string;
  compiled: boolean;
  attempts: number;
  autoFixUsed: boolean;
  compilerErrors: string[];
  fileCount: number;
  fileNames: string[];
  durationMs: number;
  userNotes: string;
  userDesignScore: number | null;
  userFunctionalScore: number | null;
  userImagePath: string | null;
};

type Stats = {
  total: number;
  compiled: number;
  failed: number;
  compileRate: number;
  byTier: Record<string, { total: number; compiled: number; rate: number }>;
  byCategory: Record<string, { total: number; compiled: number; rate: number }>;
  avgAttempts: number;
  autoFixRate: number;
  commonErrors: Array<{ error: string; count: number }>;
  avgDesignScore: number | null;
  avgFunctionalScore: number | null;
};

function ScoreButton({
  value,
  current,
  onClick,
}: {
  value: number;
  current: number | null;
  onClick: (v: number) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`h-8 w-8 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-[var(--transition-fast)] ${
        active
          ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] shadow-[0_0_12px_rgba(var(--accent-rgb),0.35)]"
          : "bg-[var(--background-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
      }`}
    >
      {value}
    </button>
  );
}

function ResultRow({
  result,
  onUpdate,
}: {
  result: BuildResult;
  onUpdate: () => void;
}) {
  const [notes, setNotes] = useState(result.userNotes);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = useCallback(
    async (updates: Record<string, unknown>) => {
      setSaving(true);
      await fetch(`/api/build-results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setSaving(false);
      onUpdate();
    },
    [result.id, onUpdate]
  );

  const saveNotes = useCallback(() => {
    if (notes !== result.userNotes) save({ userNotes: notes });
  }, [notes, result.userNotes, save]);

  const date = new Date(result.timestamp);
  const timeStr = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const durationStr =
    result.durationMs > 0 ? `${Math.round(result.durationMs / 1000)}s` : "—";

  return (
    <article
      className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4 transition-all duration-[var(--transition-normal)] hover:border-[var(--border-subtle)]"
      style={{
        background: "var(--background-secondary)",
        boxShadow: "0 1px 0 0 var(--border-default)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                result.compiled
                  ? "bg-[var(--badge-live)]/15 text-[var(--semantic-success)] border border-[var(--badge-live)]/30"
                  : "bg-[var(--badge-error)]/15 text-[var(--semantic-error)] border border-[var(--badge-error)]/30"
              }`}
            >
              {result.compiled ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <XCircle className="h-3.5 w-3.5" aria-hidden />
              )}
              {result.compiled ? "Compiled" : "Failed"}
            </span>
            {result.autoFixUsed && (
              <span className="inline-flex items-center rounded-full border border-[var(--semantic-warning)]/40 bg-[var(--semantic-warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--semantic-warning)]">
                Auto-fixed ({result.attempts} attempts)
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {timeStr}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {durationStr}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {result.fileCount} files
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 block w-full text-left text-sm font-medium text-[var(--text-primary)] line-clamp-2 transition-colors hover:text-[var(--link-default)]"
          >
            {result.prompt || result.projectName}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[var(--border-default)] pt-3">
          <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
            {result.prompt}
          </p>
          {result.fileNames.length > 0 && (
            <p className="text-xs text-[var(--text-tertiary)]">
              Files: {result.fileNames.join(", ")}
            </p>
          )}
          {result.compilerErrors.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--badge-error)]/30 bg-[var(--badge-error)]/10 p-3">
              <p className="mb-1.5 text-xs font-medium text-[var(--semantic-error)]">
                Compiler errors
              </p>
              {result.compilerErrors.slice(0, 5).map((e, i) => (
                <p
                  key={i}
                  className="break-all font-mono text-xs text-[var(--text-secondary)]"
                >
                  {e}
                </p>
              ))}
              {result.compilerErrors.length > 5 && (
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  +{result.compilerErrors.length - 5} more
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">
            Design
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <ScoreButton
                key={v}
                value={v}
                current={result.userDesignScore}
                onClick={(val) => save({ userDesignScore: val })}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">
            Functionality
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <ScoreButton
                key={v}
                value={v}
                current={result.userFunctionalScore}
                onClick={(val) => save({ userFunctionalScore: val })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          onKeyDown={(e) => e.key === "Enter" && saveNotes()}
          placeholder="Add notes (overlaps, broken buttons, etc.)…"
          className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] transition-colors focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30"
        />
        {saving && (
          <span className="self-center text-xs text-[var(--text-tertiary)]">
            Saving…
          </span>
        )}
      </div>

      <div className="mt-3 border-t border-[var(--border-default)] pt-3">
        <p className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">
          Screenshot (what the app looks like)
        </p>
        {(result.userImagePath ?? null) ? (
          <div className="flex flex-wrap items-start gap-2">
            <img
              src={`/api/build-results/${result.id}/image`}
              alt="Build screenshot"
              className="h-24 w-auto max-w-full rounded-[var(--radius-md)] border border-[var(--border-default)] object-contain bg-[var(--background-tertiary)]"
            />
            <div className="flex flex-col gap-1">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={removing}
                onClick={async () => {
                  setRemoving(true);
                  await fetch(`/api/build-results/${result.id}/image`, {
                    method: "DELETE",
                  });
                  setRemoving(false);
                  onUpdate();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                const form = new FormData();
                form.append("image", f);
                await fetch(`/api/build-results/${result.id}/image`, {
                  method: "POST",
                  body: form,
                });
                e.target.value = "";
                setUploading(false);
                onUpdate();
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              {uploading ? "Uploading…" : "Upload screenshot"}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  color?: "green" | "yellow" | "red" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const colorClass =
    color === "green"
      ? "text-[var(--semantic-success)]"
      : color === "yellow"
        ? "text-[var(--semantic-warning)]"
        : color === "red"
          ? "text-[var(--semantic-error)]"
          : "text-[var(--text-primary)]";
  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4 transition-all duration-[var(--transition-normal)] hover:border-[var(--border-subtle)]"
      style={{
        boxShadow: "0 1px 0 0 var(--border-default)",
      }}
    >
      {Icon && (
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--background-tertiary)] text-[var(--text-tertiary)]">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      )}
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}

function StatsPanel({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total builds" value={stats.total} icon={BarChart3} />
        <StatCard
          label="Compile rate"
          value={`${stats.compileRate}%`}
          color={
            stats.compileRate >= 80
              ? "green"
              : stats.compileRate >= 50
                ? "yellow"
                : "red"
          }
          icon={CheckCircle2}
        />
        <StatCard
          label="Avg attempts"
          value={stats.avgAttempts.toFixed(1)}
          icon={RefreshCw}
        />
        <StatCard
          label="Auto-fix used"
          value={`${stats.autoFixRate}%`}
          icon={Wrench}
        />
      </div>

      {Object.keys(stats.byTier).length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            By tier
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byTier).map(([tier, d]) => (
              <div
                key={tier}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="capitalize text-[var(--text-primary)]">
                  {tier}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
                    <div
                      className="h-full rounded-full bg-[var(--button-primary-bg)] transition-all duration-[var(--transition-normal)]"
                      style={{ width: `${d.rate}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-[var(--text-tertiary)]">
                    {d.compiled}/{d.total} ({d.rate}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(stats.avgDesignScore !== null || stats.avgFunctionalScore !== null) && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Avg design score"
            value={
              stats.avgDesignScore !== null
                ? `${stats.avgDesignScore.toFixed(1)}/5`
                : "—"
            }
          />
          <StatCard
            label="Avg functionality score"
            value={
              stats.avgFunctionalScore !== null
                ? `${stats.avgFunctionalScore.toFixed(1)}/5`
                : "—"
            }
          />
        </div>
      )}

      {stats.commonErrors.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Most common errors
          </h3>
          <div className="space-y-1.5">
            {stats.commonErrors.slice(0, 10).map((e, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <span className="min-w-0 flex-1 break-all font-mono text-[var(--text-secondary)]">
                  {e.error}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--text-tertiary)]">
                  {e.count}×
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function BuildsPage() {
  const [results, setResults] = useState<BuildResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<"all" | "compiled" | "failed">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [resultsRes, statsRes] = await Promise.all([
      fetch("/api/build-results?limit=200"),
      fetch("/api/build-results?stats=true"),
    ]);
    const resultsData = await resultsRes.json().catch(() => ({ results: [] }));
    const statsData = await statsRes.json().catch(() => null);
    setResults(resultsData.results ?? []);
    setStats(statsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filter === "all"
      ? results
      : results.filter((r) =>
          filter === "compiled" ? r.compiled : !r.compiled
        );

  const filterOptions: SelectOption[] = [
    { value: "all", label: `All (${results.length})` },
    {
      value: "compiled",
      label: `Compiled (${results.filter((r) => r.compiled).length})`,
    },
    {
      value: "failed",
      label: `Failed (${results.filter((r) => !r.compiled).length})`,
    },
  ];

  return (
    <div
      className="min-h-screen text-[var(--text-primary)]"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(var(--accent-rgb), 0.08) 0%, transparent 50%), var(--background-primary)",
      }}
    >
      <header className="border-b border-[var(--border-default)] bg-[var(--background-primary)]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Dashboard
            </Link>
            <span
              className="h-4 w-px bg-[var(--border-default)]"
              aria-hidden
            />
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Build Results
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <section className="mb-8">
          <div className="mb-1 flex items-center gap-2">
            <FileCode2
              className="h-5 w-5 text-[var(--button-primary-bg)]"
              aria-hidden
            />
            <h2 className="text-[var(--text-2xl)] font-semibold tracking-tight text-[var(--text-primary)]">
              Pro build quality
            </h2>
          </div>
          <p className="max-w-xl text-[var(--text-base)] text-[var(--text-secondary)]">
            Track what compiles, what fails, and where the model struggles. Score
            design and functionality, and add notes for follow-up.
          </p>
        </section>

        {stats && <StatsPanel stats={stats} />}

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Builds
            </h3>
            <DropdownSelect
              options={filterOptions}
              value={filter}
              onChange={(v) => setFilter(v as "all" | "compiled" | "failed")}
              aria-label="Filter builds by status"
              className="min-w-[140px]"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] py-16">
              <RefreshCw
                className="h-10 w-10 animate-spin text-[var(--text-tertiary)]"
                aria-hidden
              />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Loading build results…
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] py-16 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--background-tertiary)] text-[var(--text-tertiary)]">
                <Sparkles className="h-7 w-7" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
                No build results yet
              </h3>
              <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
                Pro (Swift) builds are logged when validation finishes—success or
                fail. If validation is still running, wait for it to complete,
                then refresh.
              </p>
              <Button
                variant="secondary"
                className="mt-4 gap-2"
                onClick={() => load()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <ResultRow key={r.id} result={r} onUpdate={load} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
