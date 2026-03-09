"use client";

import * as Sentry from "@sentry/nextjs";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Loader2,
  ChevronDown,
  ChevronUp,
  Square,
  Clipboard,
} from "lucide-react";
import { Button, DropdownSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { getErrorCategoryLabel } from "@/lib/errorPatterns";
import { stripOldImages, type VisionMessage } from "@/lib/visionTestUtils";

type VisionTestReport = {
  projectId: string;
  appName: string;
  totalActions: number;
  duration: number;
  allIssues: string[];
  featuresTestedSuccessfully: string[];
  featuresThatCouldNotBeTested: string[];
  screenshots: string[];
  overallScore: number;
  recommendation: "Pass" | "Minor issues" | "Major issues" | "Fail" | "Rebuild required" | "Stopped";
  cursorPrompt: string;
  total_cost_usd?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  /** Issue type tags from every step (e.g. broken_button, keyboard_blocking). */
  issueTags?: string[];
};

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
  /** Full history of errors per attempt (when available). */
  errorHistory?: Array<{ attempt: number; errors: string[] }>;
  /** Human-readable reason the build failed (e.g. "Max attempts (8) reached"). */
  errorMessage?: string | null;
  fileCount: number;
  fileNames: string[];
  durationMs: number;
  userNotes: string;
  userDesignScore: number | null;
  userFunctionalScore: number | null;
  userImagePath: string | null;
  issueTags: string[];
  /** Estimated API cost in USD for the generation that produced this build. */
  generationCostUsd?: number | null;
  /** Source code of Swift files that had compiler errors (path -> content), for display. */
  sourceFiles?: Record<string, string> | null;
};

/** One attempt's compiler errors in error history. */
type ErrorHistoryEntry = { attempt: number; errors: string[] };

/** Active build job from /api/build-jobs/active (in progress or auto-fixing). */
type ActiveBuildJob = {
  id: string;
  createdAt: number;
  startedAt?: number;
  status: "queued" | "running" | "succeeded" | "failed" | "generating";
  request: {
    projectId: string;
    projectName: string;
    userPrompt?: string;
    attempt?: number;
    maxAttempts?: number;
  };
  compilerErrors?: string[];
  /** Full history of errors per attempt (when available); prefer over compilerErrors for display. */
  errorHistory?: ErrorHistoryEntry[];
  autoFixInProgress?: boolean;
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

type DateRangeKey = "today" | "7d" | "30d" | "all";

const DATE_RANGE_OPTIONS: SelectOption[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function sinceParam(range: DateRangeKey): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  const d = new Date(now);
  d.setDate(d.getDate() - (range === "7d" ? 7 : 30));
  return d.toISOString();
}

/** Normalize compiler error for grouping (match server logic). */
function normalizeError(line: string): string {
  return line.replace(/\S+\.swift:\d+(:\d+)?:\s*/, "").trim();
}

function buildContainsError(b: BuildResult, normalizedError: string): boolean {
  const all = [
    ...b.compilerErrors,
    ...(b.errorHistory ?? []).flatMap((e) => e.errors ?? []),
  ];
  return all.some((e) => normalizeError(e) === normalizedError);
}

type ErrorPatternStatusValue = "Open" | "Fixed" | "Wontfix" | "Regression";
type ErrorPatternStatusDoc = {
  error: string;
  status: ErrorPatternStatusValue;
  fixedAt: string | null;
  updatedAt: string;
};

/** Parse "Path.swift:85:69: error: ..." -> { fileRef, line }. */
function parseErrorLocations(errors: string[]): Array<{ fileRef: string; line: number }> {
  const out: Array<{ fileRef: string; line: number }> = [];
  for (const line of errors) {
    const m = line.match(/([^\s:]+\.swift):(\d+)(?::\d+)?/);
    if (m) out.push({ fileRef: m[1], line: parseInt(m[2], 10) });
  }
  return out;
}

/** Build map: source path -> set of line numbers that have errors. */
function errorLinesBySourcePath(
  errors: string[],
  errorHistory: Array<{ attempt: number; errors: string[] }> | undefined,
  sourcePaths: string[]
): Record<string, Set<number>> {
  const locations = parseErrorLocations(errors);
  if (Array.isArray(errorHistory)) {
    for (const e of errorHistory) for (const loc of parseErrorLocations(e.errors ?? [])) locations.push(loc);
  }
  const byPath: Record<string, Set<number>> = {};
  for (const path of sourcePaths) {
    const set = new Set<number>();
    const base = path.split("/").pop() ?? path;
    for (const { fileRef, line } of locations) {
      if (path === fileRef || path.endsWith("/" + fileRef) || base === fileRef) set.add(line);
    }
    if (set.size > 0) byPath[path] = set;
  }
  return byPath;
}

function FailingSourceView({
  compilerErrors,
  errorHistory,
  sourceFiles,
  className = "",
  defaultExpanded = false,
}: {
  compilerErrors: string[];
  errorHistory?: Array<{ attempt: number; errors: string[] }>;
  sourceFiles: Record<string, string>;
  className?: string;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  useEffect(() => {
    if (defaultExpanded) setOpen(true);
  }, [defaultExpanded]);
  const paths = Object.keys(sourceFiles);
  const errorLines = useMemo(
    () => errorLinesBySourcePath(compilerErrors, errorHistory, paths),
    [compilerErrors, errorHistory, paths]
  );
  const filesWithErrors = paths.filter((p) => (errorLines[p]?.size ?? 0) > 0);
  if (filesWithErrors.length === 0) return null;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        Failing source ({filesWithErrors.length} file{filesWithErrors.length !== 1 ? "s" : ""})
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)] p-3">
          {filesWithErrors.map((path) => {
            const content = sourceFiles[path] ?? "";
            const lines = content.split("\n");
            const highlight = errorLines[path];
            return (
              <div key={path}>
                <p className="mb-1.5 font-mono text-[10px] font-medium text-[var(--text-tertiary)]">{path}</p>
                <div className="overflow-x-auto rounded border border-[var(--border-default)] bg-[var(--background-elevated)]">
                  <table className="w-full border-collapse font-mono text-xs text-[var(--text-secondary)]">
                    <tbody>
                      {lines.map((line, i) => {
                        const lineNum = i + 1;
                        const isError = highlight?.has(lineNum);
                        return (
                          <tr
                            key={lineNum}
                            className={isError ? "bg-[var(--badge-error)]/20" : ""}
                          >
                            <td className="w-10 shrink-0 select-none border-r border-[var(--border-default)] pr-2 text-right align-top text-[var(--text-tertiary)]">
                              {lineNum}
                            </td>
                            <td className="min-w-0 whitespace-pre break-all pl-2">{line || " "}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompilerErrorsBlock({ errors, className = "" }: { errors: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const count = errors.length;
  if (count === 0) return null;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        Compiler Errors ({count})
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--badge-error)]/30 bg-[var(--badge-error)]/10 p-3">
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-secondary)]">
            {errors.join("\n\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

function ErrorHistoryBlock({
  errorHistory,
  className = "",
}: {
  errorHistory: ErrorHistoryEntry[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const totalErrors = errorHistory.reduce((n, e) => n + e.errors.length, 0);
  if (errorHistory.length === 0 || totalErrors === 0) return null;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        Compiler Errors ({errorHistory.length} attempt{errorHistory.length !== 1 ? "s" : ""}, {totalErrors} total)
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-[var(--radius-md)] border border-[var(--badge-error)]/30 bg-[var(--badge-error)]/10 p-3">
          {errorHistory.map(({ attempt, errors }) => (
            <div key={attempt}>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-primary)]">
                Attempt {attempt} errors:
              </p>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-secondary)]">
                {errors.map((e) => `- ${e}`).join("\n")}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreButton({
  value,
  current,
  onClick,
}: {
  value: number;
  current: number | null;
  onClick: (v: number | null) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(active ? null : value)}
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
  visionTestReport,
  visionTestRunning,
  visionTestStep,
  visionTestCostUsd,
  visionTestRunningSomewhere,
  onRunVisionTest,
  onReTestVision,
  onStopVisionTest,
  claudeAutoPopulated,
  selectedErrorFilter = null,
}: {
  result: BuildResult;
  onUpdate: () => void;
  visionTestReport?: VisionTestReport | null;
  visionTestRunning?: boolean;
  visionTestStep?: number;
  visionTestCostUsd?: number;
  visionTestRunningSomewhere?: boolean;
  onRunVisionTest?: () => void;
  onReTestVision?: () => void;
  onStopVisionTest?: () => void;
  claudeAutoPopulated?: { functionality?: boolean; notes?: boolean; screenshot?: boolean };
  selectedErrorFilter?: string | null;
}) {
  const [notes, setNotes] = useState(result.userNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detectedTags, setDetectedTags] = useState<string[]>(result.issueTags ?? []);
  const [expanded, setExpanded] = useState(false);
  const [visionExpanded, setVisionExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyReport = useCallback(() => {
    const status = result.compiled ? "Compiled" : "Failed";
    const autoFix = result.autoFixUsed ? `${result.attempts} attempts` : "None";
    const errorsBlock =
      (result.errorHistory?.length ?? 0) > 0
        ? result
            .errorHistory!.map(
              ({ attempt, errors }) =>
                `Attempt ${attempt} errors:\n${errors.map((e) => `- ${e}`).join("\n")}`
            )
            .join("\n\n")
        : result.compilerErrors.length > 0
          ? result.compilerErrors.join("\n")
          : "None";
    const apiCost =
      typeof result.generationCostUsd === "number"
        ? `~$${result.generationCostUsd.toFixed(2)}`
        : typeof visionTestReport?.total_cost_usd === "number"
          ? `~$${visionTestReport.total_cost_usd.toFixed(2)}`
          : "—";
    const duration =
      result.durationMs > 0
        ? `${Math.round(result.durationMs / 1000)}s`
        : "—";
    const report = `Status: ${status}
Prompt: ${result.prompt || "(none)"}
Auto-fix: ${autoFix}
Compiler Errors:
${errorsBlock}
API Cost: ${apiCost}
Files: ${result.fileCount}
Duration: ${duration}

---
Based on this, should we fix the system prompt, a skill file, or both? If so, give the exact Cursor prompt to make the change.
`;
    navigator.clipboard.writeText(report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  }, [result, visionTestReport]);

  useEffect(() => {
    setNotes(result.userNotes);
  }, [result.userNotes]);

  const save = useCallback(
    async (updates: Record<string, unknown>) => {
      setSaving(true);
      const res = await fetch(`/api/build-results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result?.issueTags) setDetectedTags(json.result.issueTags);
      }
      setSaving(false);
      onUpdate();
    },
    [result.id, onUpdate]
  );

  const saveNotes = useCallback(() => {
    if (notes !== result.userNotes) {
      save({ userNotes: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
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
            {result.compiled && result.projectId && onRunVisionTest && (
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  disabled={visionTestRunning === true || visionTestRunningSomewhere === true}
                  onClick={(e) => { e.stopPropagation(); onRunVisionTest(); }}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-2 py-1 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)] disabled:opacity-50"
                  title="Run Claude vision automated test (requires Appetize preview)"
                >
                  {visionTestRunning ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Claude testing… ({visionTestStep ?? 0}/30)
                      {typeof visionTestCostUsd === "number" && (
                        <span className="text-[var(--text-tertiary)]"> · ${visionTestCostUsd.toFixed(4)}</span>
                      )}
                    </>
                  ) : visionTestReport ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => { ev.stopPropagation(); setVisionExpanded(true); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setVisionExpanded(true); } }}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        visionTestReport.recommendation === "Stopped"
                          ? "bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]"
                          : visionTestReport.overallScore >= 85
                            ? "bg-[var(--semantic-success)]/20 text-[var(--semantic-success)]"
                            : visionTestReport.overallScore >= 60
                              ? "bg-amber-500/20 text-amber-600"
                              : visionTestReport.overallScore >= 30
                                ? "bg-orange-500/20 text-orange-600"
                                : "bg-[var(--semantic-error)]/20 text-[var(--semantic-error)]"
                      }`}
                      title={`${visionTestReport.recommendation} — click to expand`}
                    >
                      {visionTestReport.recommendation === "Stopped" ? "Stopped" : visionTestReport.overallScore}
                    </span>
                  ) : (
                    "Auto Test"
                  )}
                </button>
                {visionTestRunning && onStopVisionTest && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStopVisionTest(); }}
                    className="inline-flex items-center rounded border border-[var(--semantic-error)]/50 bg-[var(--semantic-error)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--semantic-error)] hover:bg-[var(--semantic-error)]/25"
                    title="Stop vision test"
                    aria-label="Stop vision test"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" aria-hidden />
                  </button>
                )}
                {visionTestReport && onReTestVision && (
                  <button
                    type="button"
                    disabled={visionTestRunningSomewhere === true}
                    onClick={(e) => { e.stopPropagation(); onReTestVision(); }}
                    className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-transparent px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                    title="Run vision test again"
                  >
                    Re-test
                  </button>
                )}
              </div>
            )}
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
        </div>
      )}

      {/* Show failure reason when present (e.g. "Max attempts (8) reached"). */}
      {!result.compiled && result.errorMessage && (
        <p className="mt-3 border-t border-[var(--border-default)] pt-3 text-sm font-medium text-[var(--semantic-error)]">
          {result.errorMessage}
        </p>
      )}

      {/* Always show error history when present, including for compiled builds (so auto-fix attempts are visible). */}
      {(result.errorHistory?.length ?? 0) > 0 ? (
        <ErrorHistoryBlock errorHistory={result.errorHistory!} className="mt-3 border-t border-[var(--border-default)] pt-3" />
      ) : (
        <CompilerErrorsBlock errors={result.compilerErrors} className="mt-3 border-t border-[var(--border-default)] pt-3" />
      )}
      {result.sourceFiles &&
        Object.keys(result.sourceFiles).length > 0 &&
        (result.compilerErrors.length > 0 || (result.errorHistory?.length ?? 0) > 0) && (
          <FailingSourceView
            compilerErrors={result.compilerErrors}
            errorHistory={result.errorHistory}
            sourceFiles={result.sourceFiles}
            className="mt-3 border-t border-[var(--border-default)] pt-3"
            defaultExpanded={!!(selectedErrorFilter && buildContainsError(result, selectedErrorFilter))}
          />
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
                onClick={(val) => save({ userDesignScore: val ?? null })}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">
            Functionality
            {claudeAutoPopulated?.functionality && (
              <span className="ml-1 rounded bg-[var(--button-primary-bg)]/20 px-1 py-0.5 text-[10px] text-[var(--button-primary-bg)]">Claude</span>
            )}
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <ScoreButton
                key={v}
                value={v}
                current={result.userFunctionalScore}
                onClick={(val) => save({ userFunctionalScore: val ?? null })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            QA Notes
            {claudeAutoPopulated?.notes && (
              <span className="ml-1 rounded bg-[var(--button-primary-bg)]/20 px-1 py-0.5 text-[10px] text-[var(--button-primary-bg)]">Claude</span>
            )}
          </label>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {saving ? "Saving…" : saved ? "✓ Saved — tags auto-detected" : "Press Enter or click away to save"}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              saveNotes();
            }
          }}
          rows={2}
          placeholder={"What's broken or off? e.g.\n• menu overlaps the start button • can't tap settings • navigation doesn't go back • slider covers the text"}
          className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] transition-colors focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30"
        />
        {detectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {detectedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        {visionTestReport?.issueTags && visionTestReport.issueTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const counts = visionTestReport.issueTags.reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc; }, {} as Record<string, number>);
              return Object.entries(counts).map(([tag, count]) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
                >
                  {tag.replace(/_/g, " ")}{count > 1 ? ` ×${count}` : ""}
                </span>
              ));
            })()}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-[var(--border-default)] pt-3">
        <p className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">
          Screenshot (what the app looks like)
          {claudeAutoPopulated?.screenshot && (
            <span className="ml-1 rounded bg-[var(--button-primary-bg)]/20 px-1 py-0.5 text-[10px] text-[var(--button-primary-bg)]">Claude</span>
          )}
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
                className="gap-1.5 text-xs py-1.5 px-2 min-h-0"
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
                className="gap-1.5 text-xs py-1.5 px-2 min-h-0"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                {uploading ? "Uploading…" : "Upload screenshot"}
              </Button>
          </div>
        )}
      </div>

      {visionTestReport && (
        <div className="mt-3 border-t border-[var(--border-default)] pt-3">
          <button
            type="button"
            onClick={() => setVisionExpanded(!visionExpanded)}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Claude vision report
            {visionExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {visionExpanded && (
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)] p-3 space-y-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Auto test: {visionTestReport.overallScore}/100 — {visionTestReport.recommendation}
              </p>
              {typeof visionTestReport.total_cost_usd === "number" && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  Claude API cost: ${visionTestReport.total_cost_usd.toFixed(4)}
                  {typeof visionTestReport.total_input_tokens === "number" && typeof visionTestReport.total_output_tokens === "number" && (
                    <> ({visionTestReport.total_input_tokens} input tokens, {visionTestReport.total_output_tokens} output tokens)</>
                  )}
                </p>
              )}
              {visionTestReport.allIssues.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Issues found</p>
                  <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
                    {visionTestReport.allIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {visionTestReport.featuresTestedSuccessfully.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Features tested</p>
                  <p className="text-xs text-[var(--text-secondary)]">{visionTestReport.featuresTestedSuccessfully.join(", ")}</p>
                </div>
              )}
              {visionTestReport.screenshots.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {visionTestReport.screenshots.slice(0, 8).map((b64, i) => (
                    <img key={i} src={`data:image/png;base64,${b64}`} alt="" className="h-20 w-auto shrink-0 rounded border border-[var(--border-default)]" />
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(visionTestReport.cursorPrompt);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-2 py-1 text-xs font-medium text-[var(--button-secondary-text)]"
              >
                {copied ? "Copied!" : "Copy fix prompt"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-[var(--border-default)] pt-3">
        <button
          type="button"
          onClick={copyReport}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
        >
          <Clipboard className="h-3.5 w-3.5" aria-hidden />
          {reportCopied ? "Copied!" : "Copy Report"}
        </button>
      </div>
    </article>
  );
}

function ActiveJobCard({
  job,
  onCancel,
}: {
  job: ActiveBuildJob;
  onCancel?: (jobId: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const isAutoFixing = job.status === "failed" && job.autoFixInProgress;
  const isInProgress = job.status === "queued" || job.status === "running" || job.status === "generating";
  const attempt = job.request.attempt ?? 1;
  const maxAttempts = job.request.maxAttempts ?? 1;
  const displayName = job.request.projectName || job.request.userPrompt || "Building…";
  const errorHistory = job.errorHistory ?? [];
  const compilerErrors = job.compilerErrors ?? [];

  const handleCancel = async () => {
    if (!onCancel || cancelling) return;
    setCancelling(true);
    try {
      await onCancel(job.id);
    } finally {
      setCancelling(false);
    }
  };

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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--semantic-warning)]/40 bg-[var(--semantic-warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--semantic-warning)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {isAutoFixing ? "Auto-fixing" : "Building"}
            </span>
            {isAutoFixing && (
              <span className="text-xs text-[var(--text-secondary)]">
                Auto-fixing attempt {attempt}/{maxAttempts}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {new Date(job.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-[var(--text-primary)] line-clamp-2">
            {displayName}
          </p>
        </div>
        {onCancel && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="shrink-0"
            title="Stop this build / auto-fix"
          >
            {cancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Square className="h-4 w-4" aria-hidden />
            )}
            {cancelling ? "Cancelling…" : "Stop"}
          </Button>
        )}
      </div>
      {errorHistory.length > 0 ? (
        <ErrorHistoryBlock errorHistory={errorHistory} className="mt-3 border-t border-[var(--border-default)] pt-3" />
      ) : (
        <CompilerErrorsBlock errors={compilerErrors} className="mt-3 border-t border-[var(--border-default)] pt-3" />
      )}
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

function StatsPanel({
  stats,
  dateRange,
  onDateRangeChange,
  showFailuresOnly,
  onShowFailuresOnlyChange,
  errorStatuses,
  selectedErrorFilter,
  onSelectErrorFilter,
  onSetErrorStatus,
}: {
  stats: Stats;
  dateRange: DateRangeKey;
  onDateRangeChange: (v: DateRangeKey) => void;
  showFailuresOnly: boolean;
  onShowFailuresOnlyChange: (v: boolean) => void;
  errorStatuses: Record<string, ErrorPatternStatusDoc>;
  selectedErrorFilter: string | null;
  onSelectErrorFilter: (error: string | null) => void;
  onSetErrorStatus: (error: string, status: ErrorPatternStatusValue) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-tertiary)]">Date range</span>
          <DropdownSelect
            options={DATE_RANGE_OPTIONS}
            value={dateRange}
            onChange={(v) => onDateRangeChange(v as DateRangeKey)}
            aria-label="Date range"
            className="min-w-[140px]"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showFailuresOnly}
            onChange={(e) => onShowFailuresOnlyChange(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-default)]"
          />
          <span className="text-sm text-[var(--text-secondary)]">Show failures only</span>
        </label>
      </div>
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
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Most common errors
          </h3>
          <p className="mb-2 text-xs text-[var(--text-tertiary)]">
            Click an error to filter builds; use the badge to set status.
          </p>
          <div className="min-w-0 space-y-1.5 overflow-hidden">
            {stats.commonErrors.slice(0, 10).map((e, i) => {
              const status = errorStatuses[e.error]?.status ?? "Open";
              const isSelected = selectedErrorFilter === e.error;
              const knownLabel = getErrorCategoryLabel(e.error);
              return (
                <div
                  key={i}
                  className={`grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-xs ${isSelected ? "bg-[var(--badge-error)]/15 ring-1 ring-[var(--badge-error)]/40" : ""}`}
                >
                  <div className="min-w-0 overflow-hidden">
                    {knownLabel && (
                      <span className="mb-0.5 inline-block rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                        {knownLabel}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectErrorFilter(isSelected ? null : e.error)}
                      className="block w-full cursor-pointer truncate text-left font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                      title={e.error}
                    >
                      {e.error}
                    </button>
                  </div>
                  <div
                    className="flex min-w-[12rem] shrink-0 items-center gap-2 pl-2"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <span className="shrink-0 tabular-nums text-[var(--text-tertiary)]">
                      {e.count}×
                    </span>
                    <DropdownSelect
                      options={[
                        { value: "Open", label: "Open" },
                        { value: "Fixed", label: "Fixed" },
                        { value: "Wontfix", label: "Wontfix" },
                        { value: "Regression", label: "Regression" },
                      ]}
                      value={status}
                      onChange={(v) => {
                        onSetErrorStatus(e.error, v as ErrorPatternStatusValue);
                      }}
                      aria-label="Status for error"
                      className="min-w-0 shrink-0 text-[10px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

const CONTAINER_ID_BUILDS = "vision-test-appetize-container-builds";
const IFRAME_ID_BUILDS = "vision-test-appetize-iframe-builds";
const SDK_TIMEOUT_MS = 10000;

function isScreenshotMostlyBlank(base64: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        let light = 0;
        let dark = 0;
        const step = Math.max(1, Math.floor(data.length / 4 / 3000));
        for (let i = 0; i < data.length; i += 4 * step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 250 && g > 250 && b > 250) light++;
          else if (r < 5 && g < 5 && b < 5) dark++;
        }
        const sampled = Math.ceil((data.length / 4) / step);
        const blank = (light + dark) / sampled >= 0.95;
        resolve(blank);
      } catch {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = `data:image/png;base64,${base64}`;
  });
}

/** Appetize tap expects coordinates in DIP (points). Screenshot is at device pixel resolution (2x/3x). */
const VISION_TAP_DIP_WIDTH = 375;
const VISION_TAP_DIP_HEIGHT = 812;

function getImageDimensionsFromBase64(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const dataUrl = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image for dimensions"));
    img.src = dataUrl;
  });
}

function loadAppetizeScriptBuilds(): Promise<void> {
  const win = window as unknown as { appetize?: { getClient: (s: string) => Promise<unknown> } };
  if (typeof win.appetize?.getClient === "function") {
    return Promise.resolve();
  }
  if (document.querySelector('script[src="https://js.appetize.io/embed.js"]')) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + SDK_TIMEOUT_MS;
      const check = () => {
        if (typeof win.appetize?.getClient === "function") {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error("[vision-test] SDK did not load within 10 seconds"));
          return;
        }
        setTimeout(check, 100);
      };
      setTimeout(check, 300);
    });
  }
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("[vision-test] SDK did not load within 10 seconds"));
    }, SDK_TIMEOUT_MS);
    const script = document.createElement("script");
    script.src = "https://js.appetize.io/embed.js";
    script.async = true;
    script.onload = () => {
      const check = () => {
        if (typeof win.appetize?.getClient === "function") {
          clearTimeout(timeoutId);
          resolve();
          return;
        }
        setTimeout(check, 100);
      };
      setTimeout(check, 500);
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Appetize script failed to load"));
    };
    document.head.appendChild(script);
  });
}

function scoreToFunctionalRating(score: number): number {
  if (score >= 85) return 5;
  if (score >= 60) return 4;
  if (score >= 30) return 3;
  if (score >= 1) return 2;
  return 1;
}

/** Strip data URL prefix if present; Claude API expects raw base64 only. */
function toRawBase64(s: string): string {
  return s.replace(/^data:image\/\w+;base64,/, "");
}

/** Convert raw base64 to Blob without using a data URL (avoids ERR_INVALID_URL for large images). */
function base64ToBlob(rawBase64: string, mimeType: string = "image/png"): Blob {
  const base64 = toRawBase64(rawBase64);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export default function BuildsPage() {
  const [results, setResults] = useState<BuildResult[]>([]);
  const [activeJobs, setActiveJobs] = useState<ActiveBuildJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<"all" | "compiled" | "failed">("all");
  const [dateRange, setDateRange] = useState<DateRangeKey>("7d");
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const [errorStatuses, setErrorStatuses] = useState<Record<string, ErrorPatternStatusDoc>>({});
  const [selectedErrorFilter, setSelectedErrorFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visionTestRunningId, setVisionTestRunningId] = useState<string | null>(null);
  const [visionTestStep, setVisionTestStep] = useState(0);
  const [visionTestCostUsd, setVisionTestCostUsd] = useState(0);
  const [visionTestReports, setVisionTestReports] = useState<Record<string, VisionTestReport>>({});
  const [visionTestTapMode, setVisionTestTapMode] = useState<"coordinates" | "elements">("elements");
  const [autoPopulatedByClaude, setAutoPopulatedByClaude] = useState<Record<string, { functionality?: boolean; notes?: boolean; screenshot?: boolean }>>({});
  const visionTestAbortControllerRef = useRef<AbortController | null>(null);
  const visionTestStopRequestedRef = useRef(false);
  const resultsRef = useRef<BuildResult[]>([]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const since = sinceParam(dateRange);

  const load = useCallback(async () => {
    const sinceQ = since ? `&since=${encodeURIComponent(since)}` : "";
    const [resultsRes, statsRes] = await Promise.all([
      fetch(`/api/build-results?limit=200${sinceQ}`),
      fetch(`/api/build-results?stats=true${sinceQ}`),
    ]);
    const resultsData = await resultsRes.json().catch(() => ({ results: [] }));
    const statsData = await statsRes.json().catch(() => null);
    const resultsList = (resultsData.results ?? []) as BuildResult[];
    setResults(resultsList);
    setVisionTestReports(() => {
      const map: Record<string, VisionTestReport> = {};
      for (const r of resultsList) {
        const report = (r as { id: string; visionTestReport?: VisionTestReport | null }).visionTestReport;
        if (report && typeof report === "object" && typeof report.overallScore === "number") {
          map[r.id] = report as VisionTestReport;
        }
      }
      return map;
    });
    setStats(statsData);

    if (resultsList.length > 0 && statsData?.commonErrors?.length) {
      try {
        const reconcileRes = await fetch("/api/admin/error-pattern-status/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ builds: resultsList }),
          credentials: "include",
        });
        if (reconcileRes.ok) {
          const { statuses } = await reconcileRes.json().catch(() => ({ statuses: {} }));
          setErrorStatuses(statuses);
        } else {
          const errorsToFetch = statsData.commonErrors.slice(0, 20).map((c: { error: string }) => c.error);
          const statusRes = await fetch("/api/admin/error-pattern-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ errors: errorsToFetch }),
            credentials: "include",
          });
          if (statusRes.ok) {
            const { statuses } = await statusRes.json().catch(() => ({ statuses: {} }));
            setErrorStatuses(statuses);
          }
        }
      } catch (err) {
        console.warn("[admin/builds] Error-pattern reconcile failed:", err);
        const errorsToFetch = statsData.commonErrors.slice(0, 20).map((c: { error: string }) => c.error);
        try {
          const statusRes = await fetch("/api/admin/error-pattern-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ errors: errorsToFetch }),
            credentials: "include",
          });
          if (statusRes.ok) {
            const { statuses } = await statusRes.json().catch(() => ({ statuses: {} }));
            setErrorStatuses(statuses);
          }
        } catch {
          // ignore
        }
      }
    } else if (statsData?.commonErrors?.length) {
      const errorsToFetch = statsData.commonErrors.slice(0, 20).map((c: { error: string }) => c.error);
      try {
        const statusRes = await fetch("/api/admin/error-pattern-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errors: errorsToFetch }),
          credentials: "include",
        });
        if (statusRes.ok) {
          const { statuses } = await statusRes.json().catch(() => ({ statuses: {} }));
          setErrorStatuses(statuses);
        }
      } catch {
        // ignore
      }
    }

    setLoading(false);
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  const pollBuildResults = useCallback(async () => {
    const sinceQ = since ? `&since=${encodeURIComponent(since)}` : "";
    try {
      const [resultsRes, statsRes] = await Promise.all([
        fetch(`/api/build-results?limit=200${sinceQ}`, { cache: "no-store" }),
        fetch(`/api/build-results?stats=true${sinceQ}`, { cache: "no-store" }),
      ]);
      const resultsData = await resultsRes.json().catch(() => ({ results: [] }));
      const statsData = await statsRes.json().catch(() => null);
      const incoming = (resultsData.results ?? []) as BuildResult[];
      setResults((prev) => {
        const prevIds = new Set(prev.map((r) => r.id));
        const updatedById = new Map(prev.map((r) => [r.id, r]));
        const newBuilds: BuildResult[] = [];
        for (const r of incoming) {
          if (updatedById.has(r.id)) {
            updatedById.set(r.id, r);
          } else {
            newBuilds.push(r);
          }
        }
        const existingOrder = prev.map((r) => updatedById.get(r.id)).filter(Boolean) as BuildResult[];
        return [...newBuilds, ...existingOrder];
      });
      setVisionTestReports((prev) => {
        const next = { ...prev };
        for (const r of incoming) {
          const report = (r as { id: string; visionTestReport?: VisionTestReport | null }).visionTestReport;
          if (report && typeof report === "object" && typeof report.overallScore === "number") {
            next[r.id] = report as VisionTestReport;
          }
        }
        return next;
      });
      if (statsData) setStats(statsData);
    } catch {
      // ignore
    }
  }, [since]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      pollBuildResults();
      intervalId = setInterval(pollBuildResults, 10000);
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    if (!document.hidden) startPolling();
    const onVisibilityChange = () => {
      if (document.hidden) stopPolling();
      else startPolling();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPolling();
    };
  }, [pollBuildResults]);

  const pollActiveJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/build-jobs/active", { cache: "no-store" });
      const data = await res.json().catch(() => ({ jobs: [] }));
      setActiveJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch {
      setActiveJobs([]);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      pollActiveJobs();
      intervalId = setInterval(pollActiveJobs, 10000);
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    if (!document.hidden) startPolling();
    const onVisibilityChange = () => {
      if (document.hidden) stopPolling();
      else startPolling();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPolling();
    };
  }, [pollActiveJobs]);

  const runVisionTest = useCallback(
    async (projectId: string, appName: string, buildResultId: string, getCurrentResult: () => BuildResult | undefined) => {
      console.log("[vision-test] Starting for project", projectId);
      let appetizeRes: Response;
      try {
        appetizeRes = await fetch(`/api/projects/${projectId}/appetize`, { cache: "no-store" });
      } catch (e) {
        console.error("[vision-test] Failed to fetch appetize key", e);
        return;
      }
      const appetizeData = await appetizeRes.json().catch(() => ({}));
      const publicKey = appetizeData?.publicKey;
      if (!publicKey) {
        console.warn("[vision-test] No Appetize public key for project", projectId, "- cannot run vision test");
        setVisionTestReports((prev) => ({
          ...prev,
          [buildResultId]: {
            projectId,
            appName,
            recommendation: "Rebuild required",
            overallScore: 0,
            allIssues: ["No Appetize key found for this app. Rebuild the app to enable vision testing."],
            featuresTestedSuccessfully: [],
            featuresThatCouldNotBeTested: [],
            totalActions: 0,
            duration: 0,
            screenshots: [],
            cursorPrompt: "No Appetize key for this app. Rebuild the app to enable vision testing.",
          },
        }));
        setVisionTestRunningId(null);
        return;
      }
      console.log("[vision-test] Appetize key found:", publicKey);

      setVisionTestRunningId(buildResultId);
      setVisionTestStep(0);
      setVisionTestCostUsd(0);

      let container = document.getElementById(CONTAINER_ID_BUILDS);
      if (!container) {
        container = document.createElement("div");
        container.id = CONTAINER_ID_BUILDS;
        container.style.cssText = "position:fixed;left:-9999px;top:0;width:378px;height:800px;z-index:1;";
        const iframe = document.createElement("iframe");
        iframe.id = IFRAME_ID_BUILDS;
        (iframe as HTMLIFrameElement).src = `https://appetize.io/embed/${publicKey}?scale=auto&grantPermissions=true`;
        iframe.width = "378";
        iframe.height = "800";
        iframe.setAttribute("frameborder", "0");
        container.appendChild(iframe);
        document.body.appendChild(container);
      } else {
        const iframe = container.querySelector("iframe");
        if (iframe) (iframe as HTMLIFrameElement).src = `https://appetize.io/embed/${publicKey}?scale=auto&grantPermissions=true`;
      }

      const start = Date.now();
      const steps: Array<{ observation?: string; issues_found?: Array<string | { description: string; issue_type: string }>; features_tested_so_far?: string[]; screenshot_base64?: string; logs_captured?: string[] }> = [];
      const messages: VisionMessage[] = [];
      let lastFeatures: string[] = [];
      let allIssues: string[] = [];
      let featuresThatCouldNotBeTested: string[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const lastTapCoords: Array<{ x: number; y: number }> = [];
      const STUCK_SAME_COORD_THRESHOLD = 3;
      const STUCK_ABORT_THRESHOLD = 5;
      let exitReason: string | null = null;

      const persistVisionResult = (report: VisionTestReport, notes: string) => {
        setResults((prev) =>
          prev.map((r) => (r.id === buildResultId ? { ...r, userNotes: notes } : r))
        );
        setVisionTestReports((prev) => ({ ...prev, [buildResultId]: report }));
        fetch(`/api/build-results/${buildResultId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visionTestReport: report, userNotes: notes }),
        }).catch((err) => console.warn("[vision-test] Failed to persist vision report", err));
      };

      try {
        console.log("[vision-test] Loading Appetize SDK...");
        await loadAppetizeScriptBuilds();
        console.log("[vision-test] SDK loaded");
        await new Promise((r) => setTimeout(r, 2500));

        type AppetizeSession = {
          tap: (o: unknown) => Promise<void>;
          type: (t: string) => Promise<void>;
          keypress?: (key: string) => Promise<void>;
          swipe: (o: unknown) => Promise<void>;
          screenshot: (fmt?: string) => Promise<{ data: string }>;
          getUI?: () => Promise<unknown>;
          end: () => Promise<void>;
          on?: (event: string, cb: (log: unknown) => void) => void;
          heartbeat?: () => Promise<void>;
        };
        type AppetizeClient = { startSession: (config?: { grantPermissions?: boolean; debug?: boolean }) => Promise<AppetizeSession> };
        type AppetizeGlobal = { getClient: (selector: string) => Promise<AppetizeClient> };
        const win = window as unknown as { appetize?: AppetizeGlobal };
        console.log("[vision-test] Starting session...");
        const client = await win.appetize?.getClient(`#${IFRAME_ID_BUILDS}`);
        if (!client) {
          console.error("[vision-test] Appetize client not found - getClient returned null/undefined");
          throw new Error("Appetize client not found");
        }
        const session = await client.startSession({ grantPermissions: true, debug: true });
        if (!session) {
          console.error("[vision-test] Session failed to start - startSession returned null/undefined");
          throw new Error("Session not started");
        }
        console.log("[vision-test] Session started");

        const pendingLogs: string[] = [];
        if (typeof session.on === "function") {
          session.on("log", (log: unknown) => {
            const line = typeof log === "string" ? log : (log && typeof (log as { message?: string }).message === "string" ? (log as { message: string }).message : JSON.stringify(log));
            pendingLogs.push(line);
          });
          session.on("inactivityWarning", () => {
            session.heartbeat?.().catch((e) => console.warn("[vision-test] heartbeat failed", e));
          });
        }

        console.log("[vision-test] Waiting for app to load...");
        await new Promise((r) => setTimeout(r, 5000));
        let appLoaded = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const shot = await session.screenshot("base64");
            const base64 = typeof shot?.data === "string" ? shot.data : "";
            if (base64) {
              const blank = await isScreenshotMostlyBlank(toRawBase64(base64));
              if (!blank) {
                appLoaded = true;
                console.log("[vision-test] App loaded, starting test loop");
                break;
              }
            }
          } catch (_) {
            // ignore
          }
          if (attempt < 4) {
            console.log("[vision-test] Screen still blank, waiting 2s...");
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
        if (!appLoaded) {
          console.log("[vision-test] Proceeding anyway after 5 retries");
        }
        await session.heartbeat?.().catch((err) => Sentry.captureException(err));

        const maxSteps = 30;
        let stoppedByUser = false;
        console.log("[vision-test] Starting vision test with tapMode:", visionTestTapMode);
        for (let step = 0; step < maxSteps; step++) {
          if (visionTestStopRequestedRef.current) {
            stoppedByUser = true;
            console.log("[vision-test] Stop requested, exiting loop");
            break;
          }
          await session.heartbeat?.().catch((err) => Sentry.captureException(err));
          setVisionTestStep(step + 1);
          console.log("[vision-test] Step", step + 1, ": taking screenshot");
          let screenshotBase64: string;
          try {
            const shot = await session.screenshot("base64");
            screenshotBase64 = typeof shot?.data === "string" ? shot.data : "";
          } catch (e) {
            console.warn("[vision-test] Screenshot failed", e);
            exitReason = "Screenshot failed";
            break;
          }
          if (!screenshotBase64) {
            exitReason = "No screenshot data";
            break;
          }

          let screenshotWidth = VISION_TAP_DIP_WIDTH;
          let screenshotHeight = VISION_TAP_DIP_HEIGHT;
          try {
            const dims = await getImageDimensionsFromBase64(screenshotBase64);
            screenshotWidth = dims.width;
            screenshotHeight = dims.height;
          } catch {
            // keep defaults if decode fails
          }

          let uiTree: unknown = undefined;
          try {
            uiTree = await session.getUI?.();
          } catch (e) {
            console.warn("[vision-test] getUI failed", e);
          }
          if (step === 0) {
            console.log("[vision-test] DEBUG step 0 — full raw getUI() response:", uiTree);
          }
          const uiTreeString = uiTree !== undefined && uiTree !== null ? (typeof uiTree === "string" ? uiTree : JSON.stringify(uiTree)) : "";
          const truncatedUiTree = uiTreeString.slice(0, 3000);

          console.log("[vision-test] Screenshot preview:", screenshotBase64?.substring(0, 100));

          const logsSinceLastAction = [...pendingLogs];
          pendingLogs.length = 0;

          const lastThree = lastTapCoords.slice(-STUCK_SAME_COORD_THRESHOLD);
          const allSame =
            lastThree.length >= STUCK_SAME_COORD_THRESHOLD &&
            lastThree.every((c) => c.x === lastThree[0].x && c.y === lastThree[0].y);
          const stuckWarning = allSame
            ? "WARNING: You have tapped the same coordinate 3 times in a row with no change. That location is not responding. You MUST try a completely different action - tap a different area of the screen, scroll, or return done if nothing is working."
            : undefined;

          console.log("[vision-test] Step", step + 1, ": sending to Claude");
          const rawBase64 = toRawBase64(screenshotBase64);
          const logsText = logsSinceLastAction.length > 0 ? `\n\nConsole logs since last action:\n${logsSinceLastAction.map((l) => `[${l}]`).join("\n")}` : "";
          const userText =
            step === 0
              ? `App: ${appName}. Step 1. This is the first step. Describe what you see and choose the first action to start testing. Current screenshot is attached.${truncatedUiTree ? `\n\nHere is the UI element tree for this screen:\n${truncatedUiTree}` : ""}${logsText}\n\nRespond with a single JSON object only (no markdown, no explanation).`
              : `${stuckWarning ? stuckWarning + "\n\n" : ""}Here is the screen after your last action. What do you do next?${logsText}`;
          const userContent: VisionMessage["content"] = [
            { type: "text", text: userText },
            { type: "image", source: { type: "base64", media_type: "image/png", data: rawBase64 } },
          ];
          messages.push({ role: "user", content: userContent });

          let stepRes: Response | null = null;
          try {
            stepRes = await fetch(`/api/projects/${projectId}/vision-test-step`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: stripOldImages(messages), tapMode: visionTestTapMode }),
              signal: visionTestAbortControllerRef.current?.signal,
            });
          } catch (e) {
            const err = e as { name?: string; message?: string };
            if (err?.name === "AbortError" || err?.message?.includes("abort")) {
              stoppedByUser = true;
              console.log("[vision-test] Stop requested, exiting loop");
            }
          }
          if (stoppedByUser) {
            exitReason = "Stop button";
            break;
          }
          if (!stepRes?.ok) {
            exitReason = "Step API failed";
            console.warn("[vision-test] Step API failed", stepRes?.status);
            break;
          }

          const actionData = await stepRes.json().catch(() => ({}));
          if (Array.isArray(actionData?.assistantContent)) {
            messages.push({ role: "assistant", content: actionData.assistantContent });
          }
          const action = actionData?.action;
          const obs = actionData?.observation;
          const issues = Array.isArray(actionData?.issues_found) ? actionData.issues_found : [];
          const issueDescriptions = issues.map((i: string | { description?: string }) => (typeof i === "string" ? i : i.description ?? String(i)));
          const features = Array.isArray(actionData?.features_tested_so_far) ? actionData.features_tested_so_far : [];

          totalInputTokens += typeof actionData?.input_tokens === "number" ? actionData.input_tokens : 0;
          totalOutputTokens += typeof actionData?.output_tokens === "number" ? actionData.output_tokens : 0;
          const costUsd = totalInputTokens / 1_000_000 * 3 + totalOutputTokens / 1_000_000 * 15;
          setVisionTestCostUsd(costUsd);

          const x = actionData?.x;
          const y = actionData?.y;
          console.log("[vision-test] Step", step + 1, ": Claude says", action, actionData?.target?.text ? `target "${actionData.target.text}"` : typeof x === "number" && typeof y === "number" ? `at ${x},${y}` : "");

          const target = actionData?.target as { text?: string; elementText?: string; elementLabel?: string; x?: number; y?: number } | undefined;
          const tapByText = actionData?.target?.text;
          const tapByElementText = typeof target?.elementText === "string" && target.elementText.length > 0 ? target.elementText : undefined;
          const tapByElementLabel = typeof target?.elementLabel === "string" && target.elementLabel.length > 0 ? target.elementLabel : undefined;
          let tapX: number | undefined;
          let tapY: number | undefined;
          const rawX = typeof x === "number" ? x : target?.x;
          const rawY = typeof y === "number" ? y : target?.y;
          if (action === "tap" && typeof rawX === "number" && typeof rawY === "number") {
            if (visionTestTapMode === "coordinates") {
              tapX = Math.max(0, Math.min(VISION_TAP_DIP_WIDTH, Math.round(rawX / 2)));
              tapY = Math.max(0, Math.min(VISION_TAP_DIP_HEIGHT, Math.round(rawY / 2)));
            } else {
              const scaleX = VISION_TAP_DIP_WIDTH / screenshotWidth;
              const scaleY = VISION_TAP_DIP_HEIGHT / screenshotHeight;
              tapX = Math.max(0, Math.min(VISION_TAP_DIP_WIDTH, Math.round(rawX * scaleX)));
              tapY = Math.max(0, Math.min(VISION_TAP_DIP_HEIGHT, Math.round(rawY * scaleY)));
              if (screenshotWidth !== VISION_TAP_DIP_WIDTH || screenshotHeight !== VISION_TAP_DIP_HEIGHT) {
                console.log("[vision-test] Scaled tap from screenshot", screenshotWidth, "×", screenshotHeight, "to DIP:", tapX, tapY);
              }
            }
            lastTapCoords.push({ x: tapX, y: tapY });
            if (lastTapCoords.length > STUCK_ABORT_THRESHOLD) lastTapCoords.shift();
            const lastThree = lastTapCoords.slice(-STUCK_SAME_COORD_THRESHOLD);
            const lastFive = lastTapCoords.slice(-STUCK_ABORT_THRESHOLD);
            const threeSame =
              lastThree.length >= STUCK_SAME_COORD_THRESHOLD &&
              lastThree.every((c) => c.x === lastThree[0].x && c.y === lastThree[0].y);
            const fiveSame =
              lastFive.length >= STUCK_ABORT_THRESHOLD &&
              lastFive.every((c) => c.x === lastFive[0].x && c.y === lastFive[0].y);
            if (fiveSame) {
              exitReason = "Stuck (same coordinate 5 times)";
              console.log("[vision-test] Same coordinate tapped 5 times in a row, ending early");
              break;
            }
          } else if (action === "tap" && (tapByText || tapByElementText || tapByElementLabel)) {
            lastTapCoords.length = 0;
          } else {
            lastTapCoords.length = 0;
          }

          lastFeatures = features;
          allIssues = [...new Set([...allIssues, ...issueDescriptions])];
          steps.push({
            observation: obs,
            issues_found: issues,
            features_tested_so_far: features,
            screenshot_base64: step === 0 || step === maxSteps - 1 || issues.length > 0 ? screenshotBase64 : undefined,
            logs_captured: logsSinceLastAction,
          });

          const runningLog = steps
            .map((s, i) => {
              const obs = s.observation ?? "—";
              const descs = (s.issues_found ?? []).map((d) => (typeof d === "string" ? d : (d as { description?: string }).description ?? ""));
              const issuePart = descs.length > 0 ? ` Issue: ${descs.filter(Boolean).join("; ")}.` : "";
              return `Step ${i + 1}: ${obs}.${issuePart}`;
            })
            .join("\n");
          setResults((prev) =>
            prev.map((r) => (r.id === buildResultId ? { ...r, userNotes: runningLog } : r))
          );

          if (action === "done") {
            if (Array.isArray(actionData?.features_that_could_not_be_tested)) featuresThatCouldNotBeTested = actionData.features_that_could_not_be_tested;
            break;
          }

          console.log("[vision-test] Step", step + 1, ": executing action");
          try {
            if (action === "tap") {
              if (visionTestTapMode === "elements" && (tapByElementText ?? tapByElementLabel ?? tapByText)) {
                const text = tapByElementText ?? tapByText;
                if (text) {
                  await session.tap({ element: { attributes: { text } } });
                } else if (tapByElementLabel) {
                  await session.tap({ element: { attributes: { accessibilityLabel: tapByElementLabel } } });
                }
              } else if (typeof tapX === "number" && typeof tapY === "number") {
                await session.tap({ coordinates: { x: tapX, y: tapY } });
              }
            } else if (action === "type" && typeof actionData.text === "string") {
              await session.type(actionData.text);
            } else if (action === "keypress" && typeof actionData.key === "string") {
              const key = actionData.key.toLowerCase() === "return" ? "\n" : actionData.key;
              await session.keypress?.(key);
            } else if ((action === "swipe" || action === "scroll") && actionData.direction) {
              await session.swipe({ position: { x: "50%", y: "50%" }, gesture: actionData.direction });
            }
          } catch (e) {
            console.warn("[vision-test] Action failed", action, e);
          }
          try {
            await (session as { waitForAnimations?: (opts?: { timeout?: number }) => Promise<void> }).waitForAnimations?.({ timeout: 3000 });
          } catch (_) {}
          await new Promise((r) => setTimeout(r, 500));
        }

        console.log("[vision-test] Loop complete after", steps.length, "steps");

        await session.end().catch((err) => Sentry.captureException(err));

        const runningLogFromSteps = steps
          .map((s, i) => {
            const obs = s.observation ?? "—";
            const descs = (s.issues_found ?? []).map((d) => (typeof d === "string" ? d : (d as { description?: string }).description ?? ""));
            const issuePart = descs.length > 0 ? ` Issue: ${descs.filter(Boolean).join("; ")}.` : "";
            return `Step ${i + 1}: ${obs}.${issuePart}`;
          })
          .join("\n");
        let finalNotes = runningLogFromSteps;
        if (exitReason) {
          finalNotes = runningLogFromSteps + (runningLogFromSteps ? "\n\n" : "") + "Test ended early: " + exitReason;
        } else if (steps.length > 0) {
          try {
            const sumRes = await fetch(`/api/projects/${projectId}/vision-test-summarize`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                steps: steps.map((s) => ({ observation: s.observation, issues_found: s.issues_found })),
              }),
            });
            if (sumRes.ok) {
              const sumData = (await sumRes.json()) as { summary?: string };
              if (typeof sumData.summary === "string" && sumData.summary.trim()) {
                finalNotes = sumData.summary.trim();
              }
            }
          } catch (e) {
            console.warn("[vision-test] Summarize failed, keeping running log", e);
          }
        }
        const duration = Math.round((Date.now() - start) / 1000);
        const totalActions = steps.length;
        const score = Math.max(0, 100 - allIssues.length * 15);
        let recommendation: "Pass" | "Minor issues" | "Major issues" | "Fail" | "Stopped" = "Pass";
        if (stoppedByUser) recommendation = "Stopped";
        else if (score >= 85) recommendation = "Pass";
        else if (score >= 60) recommendation = "Minor issues";
        else if (score >= 30) recommendation = "Major issues";
        else recommendation = "Fail";

        const keyScreenshots = steps.map((s) => s.screenshot_base64).filter(Boolean) as string[];
        const cursorPrompt = allIssues.length > 0
          ? `Auto-test issues for **${appName}**:\n\n${allIssues.map((i) => `- ${i}`).join("\n")}\n\nFix these in SYSTEM_PROMPT_SWIFT and/or INTEGRATIONS.md.`
          : `No issues found for ${appName}.`;

        const total_cost_usd = totalInputTokens / 1_000_000 * 3 + totalOutputTokens / 1_000_000 * 15;
        const issueTags = steps.flatMap((s) =>
          (s.issues_found ?? []).map((i) => (typeof i === "string" ? "other" : (i as { issue_type?: string }).issue_type ?? "other"))
        );

        const report: VisionTestReport = {
          projectId,
          appName,
          totalActions,
          duration,
          allIssues,
          featuresTestedSuccessfully: lastFeatures,
          featuresThatCouldNotBeTested,
          screenshots: keyScreenshots,
          overallScore: score,
          recommendation,
          cursorPrompt,
          total_cost_usd,
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          issueTags,
        };

        console.log("[vision-test] Saving report...");
        await fetch(`/api/projects/${projectId}/vision-test-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
        }).catch((err) => console.warn("[vision-test] Failed to POST report", err));

        persistVisionResult(report, finalNotes);
        console.log("[vision-test] Done. Score:", score);

        const current = getCurrentResult();
        if (current) {
          const updates: { userFunctionalScore?: number; userNotes?: string } = {};
          const claudeFlags: { functionality?: boolean; notes?: boolean; screenshot?: boolean } = {};

          if (current.userFunctionalScore === null || current.userFunctionalScore === undefined) {
            updates.userFunctionalScore = scoreToFunctionalRating(score);
            claudeFlags.functionality = true;
          }
          if (!(current.userNotes ?? "").trim()) {
            updates.userNotes = finalNotes;
            claudeFlags.notes = true;
          }

          if (Object.keys(updates).length > 0) {
            await fetch(`/api/build-results/${buildResultId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            });
            setAutoPopulatedByClaude((prev) => ({ ...prev, [buildResultId]: { ...prev[buildResultId], ...claudeFlags } }));
          }

          if (!current.userImagePath && keyScreenshots.length > 0) {
            try {
              const blob = base64ToBlob(keyScreenshots[0]);
              const file = new File([blob], "vision.png", { type: "image/png" });
              const form = new FormData();
              form.append("image", file);
              const imgRes = await fetch(`/api/build-results/${buildResultId}/image`, { method: "POST", body: form });
              if (imgRes.ok) {
                setAutoPopulatedByClaude((prev) => ({ ...prev, [buildResultId]: { ...prev[buildResultId], screenshot: true } }));
              }
            } catch (e) {
              console.warn("[vision-test] Failed to upload screenshot", e);
            }
          }
        }
        load();
      } catch (e) {
        console.error("[vision-test] Error", e);
        const errMsg = e instanceof Error ? e.message : String(e);
        const partialNotes = steps.length > 0
          ? steps.map((s, i) => `Step ${i + 1}: ${s.observation ?? "—"}.${(s.issues_found?.length ?? 0) > 0 ? ` Issue: ${(s.issues_found ?? []).join("; ")}.` : ""}`).join("\n") + "\n\nTest ended early: " + errMsg
          : "Vision test error: " + errMsg;
        const total_cost_usd = totalInputTokens / 1_000_000 * 3 + totalOutputTokens / 1_000_000 * 15;
        const partialIssueTags = steps.flatMap((s) =>
          (s.issues_found ?? []).map((i) => (typeof i === "string" ? "other" : (i as { issue_type?: string }).issue_type ?? "other"))
        );
        const partialReport: VisionTestReport = {
          projectId,
          appName,
          totalActions: steps.length,
          duration: Math.round((Date.now() - start) / 1000),
          allIssues,
          featuresTestedSuccessfully: lastFeatures,
          featuresThatCouldNotBeTested,
          screenshots: steps.map((s) => s.screenshot_base64).filter(Boolean) as string[],
          overallScore: Math.max(0, 100 - allIssues.length * 15),
          recommendation: "Fail",
          cursorPrompt: allIssues.length > 0 ? `Auto-test issues for **${appName}**:\n\n${allIssues.map((i) => `- ${i}`).join("\n")}` : `Vision test error for ${appName}.`,
          total_cost_usd,
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          issueTags: partialIssueTags,
        };
        persistVisionResult(partialReport, partialNotes);
      } finally {
        setVisionTestRunningId(null);
        setVisionTestStep(0);
        setVisionTestCostUsd(0);
        visionTestStopRequestedRef.current = false;
        const el = document.getElementById(CONTAINER_ID_BUILDS);
        if (el?.parentNode) el.parentNode.removeChild(el);
      }
    },
    [load, visionTestTapMode]
  );

  const handleStopVisionTest = useCallback(() => {
    console.log("[vision-test] Stop button clicked");
    visionTestStopRequestedRef.current = true;
    visionTestAbortControllerRef.current?.abort();
  }, []);

  const handleReTestVision = useCallback(
    (buildResultId: string, projectId: string, projectName: string) => {
      setVisionTestReports((prev) => {
        const next = { ...prev };
        delete next[buildResultId];
        return next;
      });
      setAutoPopulatedByClaude((prev) => {
        const next = { ...prev };
        delete next[buildResultId];
        return next;
      });
      setResults((prev) =>
        prev.map((r) =>
          r.id === buildResultId
            ? {
                ...r,
                userNotes: "",
                userDesignScore: null,
                userFunctionalScore: null,
                userImagePath: null,
              }
            : r
        )
      );
      fetch(`/api/build-results/${buildResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visionTestReport: null,
          userNotes: "",
          userDesignScore: null,
          userFunctionalScore: null,
          userImagePath: null,
        }),
      }).catch((err) => Sentry.captureException(err));
      runVisionTest(projectId, projectName, buildResultId, () => resultsRef.current?.find((x) => x.id === buildResultId));
    },
    [runVisionTest, results]
  );

  let filtered =
    filter === "all"
      ? results
      : results.filter((r) =>
          filter === "compiled" ? r.compiled : !r.compiled
        );
  if (showFailuresOnly) filtered = filtered.filter((r) => !r.compiled);
  if (selectedErrorFilter) {
    filtered = filtered.filter((r) => buildContainsError(r, selectedErrorFilter));
  }

  /** Same project + within 5 min: treat as one build; show active job card only, not the result card. */
  const SAME_BUILD_WINDOW_MS = 5 * 60 * 1000;
  const isResultSuppressedByActiveJob = useCallback(
    (result: BuildResult) =>
      activeJobs.some((job) => {
        const nameA = (result.projectName ?? "").trim().toLowerCase();
        const nameB = (job.request?.projectName ?? "").trim().toLowerCase();
        if (nameA !== nameB) return false;
        const resultTime = new Date(result.timestamp).getTime();
        return Math.abs(resultTime - job.createdAt) <= SAME_BUILD_WINDOW_MS;
      }),
    [activeJobs]
  );

  const resultsToShow = useMemo(
    () => filtered.filter((r) => !isResultSuppressedByActiveJob(r)),
    [filtered, isResultSuppressedByActiveJob]
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

        {stats && (
          <StatsPanel
            stats={stats}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            showFailuresOnly={showFailuresOnly}
            onShowFailuresOnlyChange={setShowFailuresOnly}
            errorStatuses={errorStatuses}
            selectedErrorFilter={selectedErrorFilter}
            onSelectErrorFilter={setSelectedErrorFilter}
            onSetErrorStatus={async (error, status) => {
              if (typeof error !== "string" || !error.trim()) return;
              try {
                const res = await fetch("/api/admin/error-pattern-status", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ error, status }),
                  credentials: "include",
                });
                if (res.ok) {
                  const { status: doc } = await res.json();
                  setErrorStatuses((prev) => ({ ...prev, [error]: doc }));
                }
              } catch (err) {
                console.warn("[admin/builds] Error-pattern status update failed:", err);
              }
            }}
          />
        )}

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Builds
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[var(--text-tertiary)]">Tap mode:</span>
              <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)]/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setVisionTestTapMode("coordinates")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${visionTestTapMode === "coordinates" ? "bg-[var(--button-primary-bg)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  aria-pressed={visionTestTapMode === "coordinates"}
                >
                  Coordinates
                </button>
                <button
                  type="button"
                  onClick={() => setVisionTestTapMode("elements")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${visionTestTapMode === "elements" ? "bg-[var(--button-primary-bg)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  aria-pressed={visionTestTapMode === "elements"}
                >
                  Elements
                </button>
              </div>
              <DropdownSelect
                options={filterOptions}
                value={filter}
                onChange={(v) => setFilter(v as "all" | "compiled" | "failed")}
                aria-label="Filter builds by status"
                className="min-w-[140px]"
              />
            </div>
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
          ) : resultsToShow.length === 0 && activeJobs.length === 0 ? (
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
              {activeJobs.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--text-tertiary)]">
                    {activeJobs.length} active job{activeJobs.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      for (const job of activeJobs) {
                        if (!job?.id) continue;
                        try {
                          await fetch(`/api/build-jobs/${job.id}/cancel`, { method: "POST", credentials: "include" });
                        } catch (err) {
                          console.warn("[admin/builds] Cancel job failed:", job.id, err);
                        }
                      }
                      load();
                      pollActiveJobs();
                    }}
                    title="Stop all building / auto-fixing jobs"
                  >
                    <Square className="h-4 w-4" aria-hidden />
                    Cancel all
                  </Button>
                </div>
              )}
              {activeJobs.map((job) => (
                <ActiveJobCard
                  key={job.id}
                  job={job}
                  onCancel={async (jobId) => {
                    if (!jobId || typeof jobId !== "string") return;
                    try {
                      const res = await fetch(`/api/build-jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST", credentials: "include" });
                      if (res.ok) {
                        load();
                        pollActiveJobs();
                      }
                    } catch (err) {
                      console.warn("[admin/builds] Cancel job failed:", jobId, err);
                    }
                  }}
                />
              ))}
              {resultsToShow.map((r) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  onUpdate={load}
                  visionTestReport={visionTestReports[r.id] ?? null}
                  visionTestRunning={visionTestRunningId === r.id}
                  visionTestStep={visionTestRunningId === r.id ? visionTestStep : 0}
                  visionTestCostUsd={visionTestRunningId === r.id ? visionTestCostUsd : undefined}
                  visionTestRunningSomewhere={visionTestRunningId != null}
                  onRunVisionTest={() => runVisionTest(r.projectId, r.projectName, r.id, () => resultsRef.current?.find((x) => x.id === r.id))}
                  onReTestVision={() => handleReTestVision(r.id, r.projectId, r.projectName)}
                  onStopVisionTest={visionTestRunningId === r.id ? handleStopVisionTest : undefined}
                  claudeAutoPopulated={autoPopulatedByClaude[r.id]}
                  selectedErrorFilter={selectedErrorFilter}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
