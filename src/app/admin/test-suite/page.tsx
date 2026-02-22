"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Square,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { Button, DropdownSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

/* ────────────────────────── Types ────────────────────────── */

type AppIdea = {
  title: string;
  prompt: string;
  category: string;
  tier: "easy" | "medium" | "hard";
};

type TestResultStatus =
  | "pending"
  | "generating"
  | "building"
  | "auto-fixing"
  | "succeeded"
  | "failed"
  | "error";

type TestResult = {
  idea: AppIdea;
  status: TestResultStatus;
  projectId?: string;
  buildJobId?: string;
  compiled?: boolean;
  attempts: number;
  compilerErrors: string[];
  screenshotUrl?: string;
  durationMs: number;
  fileCount: number;
  errorMessage?: string;
  buildResultId?: string;
};

type RunConfig = {
  model: string;
  projectType: "pro";
};

type SavedRun = {
  id: string;
  timestamp: string;
  model: string;
  projectType: "pro";
  status: "running" | "completed" | "stopped";
  results: Array<{
    title: string;
    category: string;
    compiled: boolean;
    attempts: number;
    durationMs: number;
    projectId?: string;
    buildResultId?: string;
    errors: string[];
    fileCount: number;
  }>;
  summary: {
    total: number;
    compiled: number;
    compileRate: number;
    avgAttempts: number;
    totalDurationMs: number;
  };
};

/* ────────────────────────── 10 Hardcoded App Ideas ────────────────────────── */

const APP_IDEAS: AppIdea[] = [
  {
    title: "Todo list with categories",
    category: "Persistence (UserDefaults)",
    tier: "medium",
    prompt: `Build a todo app with categories. Main screen: segmented control to filter (All, Active, Completed). List of tasks with checkboxes, due dates, and priority colors (high=red, medium=orange, low=green). Add task sheet: title, due date picker, priority picker, optional notes. Swipe to delete. Sort by due date or priority. Persist with Codable + UserDefaults. Show completion percentage at top.`,
  },
  {
    title: "Expense tracker",
    category: "Persistence (UserDefaults)",
    tier: "medium",
    prompt: `Build an expense tracker with categories. Main screen: list of expenses (amount, label, category icon, date) with running total at top. Add expense sheet: amount field, label, category picker (Food, Transport, Entertainment, etc.), date picker. Filter by category using segmented control. Monthly summary view showing total per category. Persist with Codable + UserDefaults.`,
  },
  {
    title: "Product catalog",
    category: "Lists & navigation",
    tier: "medium",
    prompt: `Build a product catalog with NavigationStack. Main screen: list of products with image placeholder, name, price, and rating stars. Tap for detail: large image area, name, price, description, rating, and Add to Favorites button. Favorites screen accessible from toolbar. Search and filter by price range. Sort by price or rating. Persist favorites with Codable + UserDefaults.`,
  },
  {
    title: "Pomodoro timer",
    category: "Timers & time",
    tier: "medium",
    prompt: `Build a Pomodoro timer with session tracking. Main screen: circular timer with work/break phases. Configurable: work duration (15\u201360 min), short break (3\u201310 min), long break (15\u201330 min), sessions before long break. Start/Pause/Skip controls. Session counter (e.g. 3/4). Today\u2019s stats: completed pomodoros, total focus time. History tab: daily summaries for past 7 days. Persist with Codable + UserDefaults.`,
  },
  {
    title: "Tab bar app",
    category: "Lists & navigation",
    tier: "medium",
    prompt: `Build a 3-tab app with proper navigation. Tab 1 (Home): dashboard with summary cards. Tab 2 (Browse): searchable list with NavigationStack to detail screens. Tab 3 (Profile): profile view with settings. Badge on Browse tab showing item count. Proper back navigation within each tab. Consistent styling across tabs. Persist minimal state with UserDefaults.`,
  },
  {
    title: "Finance dashboard",
    category: "Charts & data",
    tier: "hard",
    prompt: `Build a personal finance dashboard with Swift Charts. One screen: a bar chart showing income vs spending for the last 7 days (use sample data like 3 income and 4 spending values). Below the chart, a list of recent transactions (title and amount, positive green and negative red). At the top, a savings goal progress view (e.g. "$200 / $1000"). Use SwiftUI Chart for the bar chart. Keep data in memory or a simple model.`,
  },
  {
    title: "Flashcard app",
    category: "Misc (display & interaction)",
    tier: "medium",
    prompt: `Build a flashcard study app with decks. Main screen: list of decks with card count and mastery percentage. Tap deck to study: card view with 3D flip animation (question \u2192 answer). Buttons: Know It, Still Learning, Skip. Progress bar during study session. Results screen: cards mastered vs needs review. Edit deck: add/edit/delete cards. Create new deck sheet with name and color. Import cards from text. Persist with Codable + UserDefaults.`,
  },
  {
    title: "Onboarding flow",
    category: "UI states & patterns",
    tier: "medium",
    prompt: `Build a 5-screen onboarding with progress. Horizontal paging with page indicator dots and progress bar. Each page: illustration placeholder, title, subtitle. Page 3: permission prompt (notifications toggle). Page 4: preference picker (choose interests from a grid). Last page: Get Started and Skip buttons. Animated transitions between pages. Remember completion state in UserDefaults so onboarding only shows once.`,
  },
  {
    title: "Camera placeholder",
    category: "Placeholders & demos",
    tier: "medium",
    prompt: `Build a camera app placeholder. Main screen: viewfinder area (dark rectangle) with capture button, flash toggle, and camera flip button. Gallery strip at bottom showing last 3 captures (colored placeholders). Capture creates a new placeholder with timestamp. Gallery screen: grid of all captures with date sections. Detail view: full-screen with share, delete, and info (date, size placeholder). Filters preview strip (Original, B&W, Sepia, Vivid).`,
  },
  {
    title: "Habit streak",
    category: "Design & visual",
    tier: "hard",
    prompt: `Build a habit tracker with Liquid Glass design. One screen: a list of habits (e.g. Exercise, Read, Meditate). Each habit is a card showing its name, current streak count, and a "Check in" button. Use iOS 26 and .glassEffect() on the cards. When the user taps Check in, animate the update and increment the streak. Store streaks in memory or UserDefaults. Include an option to add a new habit.`,
  },
];

/* ────────────────────────── Error Classification ────────────────────────── */

type ErrorCategory =
  | "missing_import"
  | "type_mismatch"
  | "trailing_closure"
  | "missing_conformance"
  | "member_not_found"
  | "missing_return"
  | "argument_mismatch"
  | "deprecated_api"
  | "binding_error"
  | "other";

const ERROR_PATTERNS: Array<{ category: ErrorCategory; patterns: RegExp[] }> = [
  {
    category: "missing_import",
    patterns: [
      /cannot find type '\w+' in scope/i,
      /cannot find '\w+' in scope/i,
      /no such module '\w+'/i,
      /use of unresolved identifier/i,
    ],
  },
  {
    category: "type_mismatch",
    patterns: [
      /cannot convert value of type/i,
      /cannot assign value of type/i,
    ],
  },
  {
    category: "trailing_closure",
    patterns: [/extra trailing closure/i, /contextual closure type/i],
  },
  {
    category: "missing_conformance",
    patterns: [/does not conform to protocol/i],
  },
  {
    category: "member_not_found",
    patterns: [/has no member/i, /value of type .+ has no member/i],
  },
  {
    category: "missing_return",
    patterns: [/missing return in/i, /non-void function should return/i],
  },
  {
    category: "argument_mismatch",
    patterns: [/missing argument/i, /extra argument/i, /incorrect argument label/i],
  },
  {
    category: "deprecated_api",
    patterns: [/NavigationView/i, /\.foregroundColor\b/i, /\.navigationBarTitle\b/i],
  },
  {
    category: "binding_error",
    patterns: [/cannot find type 'Binding'/i, /use of unresolved identifier '\$\w+'/i],
  },
];

function classifyError(msg: string): ErrorCategory {
  const normalized = msg.replace(/\S+\.swift:\d+(:\d+)?:\s*(error|warning):\s*/, "").trim();
  for (const { category, patterns } of ERROR_PATTERNS) {
    for (const p of patterns) {
      if (p.test(normalized)) return category;
    }
  }
  return "other";
}

function groupErrors(errors: string[]): Array<{ category: ErrorCategory; count: number }> {
  const counts: Record<string, number> = {};
  for (const e of errors) {
    const cat = classifyError(e);
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([category, count]) => ({ category: category as ErrorCategory, count }))
    .sort((a, b) => b.count - a.count);
}

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  missing_import: "Missing import",
  type_mismatch: "Type mismatch",
  trailing_closure: "Trailing closure",
  missing_conformance: "Protocol conformance",
  member_not_found: "Member not found",
  missing_return: "Missing return",
  argument_mismatch: "Argument mismatch",
  deprecated_api: "Deprecated API",
  binding_error: "Binding error",
  other: "Other",
};

/* ────────────────────────── Helpers ────────────────────────── */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ────────────────────────── NDJSON Stream Reader ────────────────────────── */

async function readNDJSONStream(
  res: Response,
  onEvent?: (event: Record<string, unknown>) => void,
): Promise<{ done: Record<string, unknown> | null }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        onEvent?.(obj);
        if (obj.type === "done") donePayload = obj;
        if (obj.type === "error") throw new Error(obj.error || "Stream error");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer);
      onEvent?.(obj);
      if (obj.type === "done") donePayload = obj;
    } catch { /* partial line */ }
  }

  return { done: donePayload };
}

/* ────────────────────────── Build Job Poller ────────────────────────── */

async function pollBuildJob(
  jobId: string,
  onStatusChange?: (status: string, attempts: number) => void,
): Promise<{ finalJob: Record<string, unknown>; attempts: number }> {
  const POLL_INTERVAL = 3000;
  const MAX_POLL_TIME = 10 * 60 * 1000;
  const start = Date.now();
  let attempts = 1;
  let currentId = jobId;

  while (Date.now() - start < MAX_POLL_TIME) {
    const res = await fetch(`/api/build-jobs/${currentId}`);
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
    const { job } = await res.json();

    if (job.status === "succeeded") {
      onStatusChange?.("succeeded", attempts);
      return { finalJob: job, attempts };
    }

    if (job.status === "failed") {
      if (job.nextJobId) {
        currentId = job.nextJobId;
        attempts++;
        onStatusChange?.("auto-fixing", attempts);
        continue;
      }
      if (job.autoFixInProgress) {
        onStatusChange?.("auto-fixing", attempts);
        await sleep(POLL_INTERVAL);
        continue;
      }
      return { finalJob: job, attempts };
    }

    onStatusChange?.(job.status, attempts);
    await sleep(POLL_INTERVAL);
  }

  throw new Error("Build job timed out after 10 minutes");
}

/* ────────────────────────── Status Badge ────────────────────────── */

function StatusBadge({ status }: { status: TestResultStatus }) {
  const configs: Record<TestResultStatus, { label: string; cls: string; Icon: typeof Clock }> = {
    pending: { label: "Pending", cls: "bg-[var(--background-tertiary)] text-[var(--text-tertiary)]", Icon: Clock },
    generating: { label: "Generating", cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30", Icon: Loader2 },
    building: { label: "Building", cls: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30", Icon: Loader2 },
    "auto-fixing": { label: "Auto-fixing", cls: "bg-[var(--semantic-warning)]/15 text-[var(--semantic-warning)] border border-[var(--semantic-warning)]/30", Icon: RefreshCw },
    succeeded: { label: "Succeeded", cls: "bg-[var(--badge-live)]/15 text-[var(--semantic-success)] border border-[var(--badge-live)]/30", Icon: CheckCircle2 },
    failed: { label: "Failed", cls: "bg-[var(--badge-error)]/15 text-[var(--semantic-error)] border border-[var(--badge-error)]/30", Icon: XCircle },
    error: { label: "Error", cls: "bg-[var(--badge-error)]/15 text-[var(--semantic-error)] border border-[var(--badge-error)]/30", Icon: AlertTriangle },
  };
  const c = configs[status];
  const spinning = status === "generating" || status === "building" || status === "auto-fixing";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.cls}`}>
      <c.Icon className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} aria-hidden />
      {c.label}
    </span>
  );
}

/* ────────────────────────── Result Row ────────────────────────── */

function ResultRow({
  result,
  onRerun,
  running,
}: {
  result: TestResult;
  onRerun?: () => void;
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4 transition-all duration-[var(--transition-normal)] hover:border-[var(--border-subtle)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <StatusBadge status={result.status} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {result.idea.title}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">{result.idea.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {result.attempts > 0 && (
            <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
              {result.attempts} attempt{result.attempts !== 1 ? "s" : ""}
            </span>
          )}
          {result.durationMs > 0 && (
            <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
              {formatDuration(result.durationMs)}
            </span>
          )}
          {result.fileCount > 0 && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {result.fileCount} files
            </span>
          )}

          {result.compiled && result.projectId && (
            <a
              href={`/api/projects/${result.projectId}/export-xcode`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-2 py-1 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)]"
            >
              <Download className="h-3 w-3" aria-hidden />
              Xcode
            </a>
          )}

          {result.screenshotUrl && (
            <img
              src={result.screenshotUrl}
              alt={`${result.idea.title} preview`}
              className="h-10 w-auto rounded-[var(--radius-sm)] border border-[var(--border-default)] object-contain bg-[var(--background-tertiary)]"
            />
          )}

          {!running && result.status !== "pending" && onRerun && (
            <button
              type="button"
              onClick={onRerun}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              title="Re-run this app"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}

          {(result.compilerErrors.length > 0 || result.errorMessage) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-[var(--border-default)] pt-3">
          {result.errorMessage && (
            <p className="mb-2 text-xs text-[var(--semantic-error)]">{result.errorMessage}</p>
          )}
          {result.compilerErrors.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--badge-error)]/30 bg-[var(--badge-error)]/10 p-3">
              <p className="mb-1.5 text-xs font-medium text-[var(--semantic-error)]">
                Compiler errors ({result.compilerErrors.length})
              </p>
              {result.compilerErrors.slice(0, 8).map((e, i) => (
                <p key={i} className="break-all font-mono text-xs text-[var(--text-secondary)]">{e}</p>
              ))}
              {result.compilerErrors.length > 8 && (
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">+{result.compilerErrors.length - 8} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ────────────────────────── Summary Panel ────────────────────────── */

function SummaryPanel({ results }: { results: TestResult[] }) {
  const completed = results.filter((r) => r.status === "succeeded" || r.status === "failed" || r.status === "error");
  if (completed.length === 0) return null;

  const compiled = completed.filter((r) => r.compiled).length;
  const totalAttempts = completed.reduce((s, r) => s + r.attempts, 0);
  const totalDuration = completed.reduce((s, r) => s + r.durationMs, 0);
  const allErrors = completed.flatMap((r) => r.compilerErrors);
  const grouped = groupErrors(allErrors);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Compile rate</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${compiled === completed.length ? "text-[var(--semantic-success)]" : compiled > 0 ? "text-[var(--semantic-warning)]" : "text-[var(--semantic-error)]"}`}>
            {compiled}/{completed.length}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Pass rate</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {completed.length > 0 ? Math.round((compiled / completed.length) * 100) : 0}%
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Avg attempts</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {completed.length > 0 ? (totalAttempts / completed.length).toFixed(1) : "—"}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total time</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {formatDuration(totalDuration)}
          </p>
        </div>
      </div>

      {grouped.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Error patterns
          </h3>
          <div className="space-y-2">
            {grouped.map(({ category, count }) => (
              <div key={category} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text-primary)]">{CATEGORY_LABELS[category]}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
                    <div
                      className="h-full rounded-full bg-[var(--semantic-error)] transition-all"
                      style={{ width: `${Math.min(100, (count / allErrors.length) * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-[var(--text-tertiary)]">{count}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Run Comparison ────────────────────────── */

function RunComparison({ runs }: { runs: SavedRun[] }) {
  const completedRuns = runs.filter((r) => r.status === "completed" && r.results.length > 0);
  const [runA, setRunA] = useState("");
  const [runB, setRunB] = useState("");

  if (completedRuns.length < 2) return null;

  const options: SelectOption[] = completedRuns.map((r) => ({
    value: r.id,
    label: `${formatTimestamp(r.timestamp)} \u2014 ${r.model === "opus-4.6" ? "Opus 4.6" : "Sonnet 4.6"} (${r.summary.compileRate}%)`,
  }));

  const a = completedRuns.find((r) => r.id === runA);
  const b = completedRuns.find((r) => r.id === runB);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[var(--button-primary-bg)]" aria-hidden />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Compare runs</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <DropdownSelect
          options={[{ value: "", label: "Select run A" }, ...options]}
          value={runA}
          onChange={setRunA}
          className="min-w-[200px]"
          aria-label="Select first run"
        />
        <span className="text-xs text-[var(--text-tertiary)]">vs</span>
        <DropdownSelect
          options={[{ value: "", label: "Select run B" }, ...options]}
          value={runB}
          onChange={setRunB}
          className="min-w-[200px]"
          aria-label="Select second run"
        />
      </div>

      {a && b && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--text-tertiary)]">App</th>
                <th className="py-2 px-3 text-center text-xs font-medium text-[var(--text-tertiary)]">
                  Run A
                </th>
                <th className="py-2 px-3 text-center text-xs font-medium text-[var(--text-tertiary)]">
                  Run B
                </th>
                <th className="py-2 pl-3 text-center text-xs font-medium text-[var(--text-tertiary)]">Change</th>
              </tr>
            </thead>
            <tbody>
              {APP_IDEAS.map((idea) => {
                const ra = a.results.find((r) => r.title === idea.title);
                const rb = b.results.find((r) => r.title === idea.title);
                const aPass = ra?.compiled ?? false;
                const bPass = rb?.compiled ?? false;
                const improved = !aPass && bPass;
                const regressed = aPass && !bPass;

                return (
                  <tr key={idea.title} className="border-b border-[var(--border-default)]/50">
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{idea.title}</td>
                    <td className="py-2 px-3 text-center">
                      {ra ? (
                        <span className={aPass ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"}>
                          {aPass ? "Pass" : "Fail"} ({ra.attempts})
                        </span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {rb ? (
                        <span className={bPass ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"}>
                          {bPass ? "Pass" : "Fail"} ({rb.attempts})
                        </span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="py-2 pl-3 text-center text-xs font-medium">
                      {improved && <span className="text-[var(--semantic-success)]">Improved</span>}
                      {regressed && <span className="text-[var(--semantic-error)]">Regressed</span>}
                      {!improved && !regressed && <span className="text-[var(--text-tertiary)]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border-default)]">
                <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">Total</td>
                <td className="py-2 px-3 text-center font-medium">{a.summary.compiled}/{a.summary.total}</td>
                <td className="py-2 px-3 text-center font-medium">{b.summary.compiled}/{b.summary.total}</td>
                <td className="py-2 pl-3 text-center text-xs font-medium">
                  {b.summary.compiled > a.summary.compiled && <span className="text-[var(--semantic-success)]">+{b.summary.compiled - a.summary.compiled}</span>}
                  {b.summary.compiled < a.summary.compiled && <span className="text-[var(--semantic-error)]">{b.summary.compiled - a.summary.compiled}</span>}
                  {b.summary.compiled === a.summary.compiled && <span className="text-[var(--text-tertiary)]">—</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/* ────────────────────────── Main Page ────────────────────────── */

export default function TestSuitePage() {
  const [model, setModel] = useState("sonnet-4.6");
  const [results, setResults] = useState<TestResult[]>(
    APP_IDEAS.map((idea) => ({
      idea,
      status: "pending" as const,
      attempts: 0,
      compilerErrors: [],
      durationMs: 0,
      fileCount: 0,
    })),
  );
  const [running, setRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [pastRuns, setPastRuns] = useState<SavedRun[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const abortRef = useRef(false);

  const loadPastRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/test-suite");
      const data = await res.json();
      setPastRuns(data.runs ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadPastRuns();
  }, [loadPastRuns]);

  const updateResult = useCallback((index: number, updates: Partial<TestResult>) => {
    setResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const runSingleTest = useCallback(
    async (index: number, config: RunConfig): Promise<TestResult> => {
      const idea = APP_IDEAS[index];
      const t0 = Date.now();

      try {
        updateResult(index, { status: "generating" });

        const project = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `[Test] ${idea.title}` }),
        }).then((r) => r.json());

        const projectId = project.id;
        updateResult(index, { projectId });

        const streamRes = await fetch(`/api/projects/${projectId}/message/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: idea.prompt,
            projectType: config.projectType,
            model: config.model,
          }),
        });

        if (!streamRes.ok) throw new Error(`Stream failed: ${streamRes.status}`);

        let projectFiles: Array<{ path: string; content: string }> | null = null;
        let fileCount = 0;

        const { done } = await readNDJSONStream(streamRes, (event) => {
          if (event.type === "file") fileCount = (event.count as number) ?? fileCount + 1;
        });

        if (!done) throw new Error("No 'done' event in stream");
        projectFiles = (done.projectFiles as Array<{ path: string; content: string }>) ?? null;
        if (!projectFiles?.length) throw new Error("No files generated");

        fileCount = projectFiles.length;
        updateResult(index, { status: "building", fileCount });

        const buildRes = await fetch(`/api/projects/${projectId}/validate-xcode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: projectFiles,
            projectName: idea.title.replace(/[^a-zA-Z0-9]/g, ""),
            bundleId: "com.vibetree.test",
            autoFix: true,
          }),
        }).then((r) => r.json());

        if (!buildRes.job?.id) throw new Error("No build job created");

        const { finalJob, attempts } = await pollBuildJob(
          buildRes.job.id,
          (status, att) => {
            updateResult(index, {
              status: status === "auto-fixing" ? "auto-fixing" : "building",
              attempts: att,
              buildJobId: buildRes.job.id,
            });
          },
        );

        const compiled = finalJob.status === "succeeded";
        const compilerErrors = (finalJob.compilerErrors as string[]) ?? [];

        let screenshotUrl: string | undefined;
        if (compiled) {
          await sleep(5000);
          screenshotUrl = `/api/projects/${projectId}/simulator-preview?t=${Date.now()}`;
        }

        const durationMs = Date.now() - t0;

        await fetch("/api/build-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            projectName: idea.title,
            prompt: idea.prompt,
            tier: idea.tier,
            category: idea.category,
            compiled,
            attempts,
            autoFixUsed: attempts > 1,
            compilerErrors,
            fileCount,
            fileNames: projectFiles.map((f) => f.path),
            durationMs,
          }),
        });

        const finalResult: Partial<TestResult> = {
          status: compiled ? "succeeded" : "failed",
          compiled,
          attempts,
          compilerErrors,
          screenshotUrl,
          durationMs,
          fileCount,
        };

        updateResult(index, finalResult);

        return {
          idea,
          projectId,
          buildJobId: buildRes.job.id,
          ...finalResult,
        } as TestResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const durationMs = Date.now() - t0;
        updateResult(index, {
          status: "error",
          compiled: false,
          errorMessage: msg,
          durationMs,
        });
        return {
          idea,
          status: "error",
          compiled: false,
          attempts: 0,
          compilerErrors: [],
          durationMs,
          fileCount: 0,
          errorMessage: msg,
        };
      }
    },
    [updateResult],
  );

  const runAllTests = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setCompletedCount(0);

    setResults(
      APP_IDEAS.map((idea) => ({
        idea,
        status: "pending",
        attempts: 0,
        compilerErrors: [],
        durationMs: 0,
        fileCount: 0,
      })),
    );

    const config: RunConfig = { model, projectType: "pro" };

    const createRes = await fetch("/api/test-suite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", model }),
    }).then((r) => r.json());

    const runId = createRes.run?.id;
    setCurrentRunId(runId);

    const finalResults: TestResult[] = [];

    for (let i = 0; i < APP_IDEAS.length; i++) {
      if (abortRef.current) break;

      const result = await runSingleTest(i, config);
      finalResults.push(result);
      setCompletedCount(i + 1);

      if (runId) {
        const summary = {
          total: finalResults.length,
          compiled: finalResults.filter((r) => r.compiled).length,
          compileRate: Math.round(
            (finalResults.filter((r) => r.compiled).length / finalResults.length) * 100,
          ),
          avgAttempts: Math.round(
            (finalResults.reduce((s, r) => s + r.attempts, 0) / finalResults.length) * 10,
          ) / 10,
          totalDurationMs: finalResults.reduce((s, r) => s + r.durationMs, 0),
        };

        await fetch("/api/test-suite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: runId,
            status: abortRef.current ? "stopped" : (i === APP_IDEAS.length - 1 ? "completed" : "running"),
            results: finalResults.map((r) => ({
              title: r.idea.title,
              category: r.idea.category,
              compiled: r.compiled ?? false,
              attempts: r.attempts,
              durationMs: r.durationMs,
              projectId: r.projectId,
              buildResultId: r.buildResultId,
              errors: r.compilerErrors,
              fileCount: r.fileCount,
            })),
            summary,
          }),
        });
      }

      if (i < APP_IDEAS.length - 1 && !abortRef.current) {
        await sleep(2000);
      }
    }

    setRunning(false);
    loadPastRuns();
  }, [model, runSingleTest, loadPastRuns]);

  const stopRun = useCallback(() => {
    abortRef.current = true;
  }, []);

  const rerunSingle = useCallback(
    async (index: number) => {
      setRunning(true);
      await runSingleTest(index, { model, projectType: "pro" });
      setRunning(false);
    },
    [model, runSingleTest],
  );

  const avgDuration = results.filter((r) => r.durationMs > 0).length > 0
    ? results.filter((r) => r.durationMs > 0).reduce((s, r) => s + r.durationMs, 0) /
      results.filter((r) => r.durationMs > 0).length
    : 0;
  const remaining = running
    ? Math.max(0, APP_IDEAS.length - completedCount) * avgDuration
    : 0;

  const modelOptions: SelectOption[] = [
    { value: "sonnet-4.6", label: "Claude Sonnet 4.6" },
    { value: "opus-4.6", label: "Claude Opus 4.6" },
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Dashboard
            </Link>
            <span className="h-4 w-px bg-[var(--border-default)]" aria-hidden />
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Test Suite
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        {/* ── Run Controls ── */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <DropdownSelect
              options={modelOptions}
              value={model}
              onChange={setModel}
              className="min-w-[180px]"
              aria-label="Select LLM model"
            />
            {!running ? (
              <Button onClick={runAllTests} className="gap-2">
                <Play className="h-4 w-4" aria-hidden />
                Start Test Run ({APP_IDEAS.length} apps)
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopRun} className="gap-2">
                <Square className="h-4 w-4" aria-hidden />
                Stop
              </Button>
            )}

            {running && (
              <div className="flex flex-1 items-center gap-3 min-w-[200px]">
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
                  <div
                    className="h-full rounded-full bg-[var(--button-primary-bg)] transition-all duration-500"
                    style={{ width: `${(completedCount / APP_IDEAS.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-[var(--text-tertiary)] shrink-0">
                  {completedCount}/{APP_IDEAS.length}
                  {remaining > 0 && ` \u2022 ~${formatDuration(remaining)} remaining`}
                </span>
              </div>
            )}

            {currentRunId && !running && (
              <span className="text-xs text-[var(--semantic-success)]">Run complete</span>
            )}
          </div>
        </section>

        {/* ── Results Table ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Results</h2>
          <div className="space-y-2">
            {results.map((result, i) => (
              <ResultRow
                key={result.idea.title}
                result={result}
                running={running}
                onRerun={() => rerunSingle(i)}
              />
            ))}
          </div>
        </section>

        {/* ── Summary ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Summary</h2>
          <SummaryPanel results={results} />
        </section>

        {/* ── Run Comparison ── */}
        {pastRuns.length >= 2 && (
          <section>
            <RunComparison runs={pastRuns} />
          </section>
        )}
      </main>
    </div>
  );
}
