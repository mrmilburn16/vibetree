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
  History,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Trash2,
  Shuffle,
  Zap,
  Copy,
  ExternalLink,
  LocateFixed,
  Pause,
  Minimize2,
  Maximize2,
  Smartphone,
  CheckSquare,
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
  generationMs?: number;
  buildMs?: number;
  fileCount: number;
  errorMessage?: string;
  buildResultId?: string;
  projectFiles?: Array<{ path: string; content: string }>;
  excluded?: boolean;
  model?: string;
  designRating?: number;
  functionalityRating?: number;
  notes?: string;
  issueTags?: string[];
  liveStatus?: string;
  startedAt?: number;
  liveEvents?: Array<{ at: number; msg: string }>;
  /** When false, this app is skipped when clicking Run (manual selection). Default true. */
  selected?: boolean;
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
  milestone?: string;
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
    model?: string;
  }>;
  summary: {
    total: number;
    compiled: number;
    compileRate: number;
    avgAttempts: number;
    totalDurationMs: number;
  };
};

/* ────────────────────────── Default 10 App Ideas ────────────────────────── */

const DEFAULT_IDEAS: AppIdea[] = [
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
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatRemainingHuman(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `~${totalMin}m left`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `~${h}h ${m}m left` : `~${h}h left`;
}

function formatETATime(remainingMs: number): string {
  const eta = new Date(Date.now() + remainingMs);
  return eta.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

function summarizeLogLine(line: string, max = 120): string {
  const cleaned = String(line || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
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

function toPascalCase(str: string): string {
  return (
    str
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("") || "App"
  );
}

const MILESTONE_LABELS: Record<string, string> = {
  "m1-baseline": "Baseline",
  "m2-easy": "Easy",
  "m3-medium": "Medium",
  "m4-hard": "Hard",
  "m5-wow": "Wow",
};

function formatModelName(m: string): string {
  if (m === "opus-4.6") return "Claude Opus 4.6";
  if (m === "sonnet-4.6") return "Claude Sonnet 4.6";
  return m;
}

function generateRunReport(
  results: TestResult[],
  opts: { milestone?: string; model?: string; target?: number },
): string {
  const completed = results.filter(
    (r) => !r.excluded && (r.status === "succeeded" || r.status === "failed" || r.status === "error"),
  );
  if (completed.length === 0) return "No completed results.";

  const compiled = completed.filter((r) => r.compiled).length;
  const totalAttempts = completed.reduce((s, r) => s + r.attempts, 0);
  const totalDuration = completed.reduce((s, r) => s + r.durationMs, 0);
  const allErrors = completed.flatMap((r) => r.compilerErrors);
  const grouped = groupErrors(allErrors);
  const failed = completed.filter((r) => !r.compiled);
  const autoFixed = completed.filter((r) => r.compiled && r.attempts > 1);
  const cleanPasses = completed.filter((r) => r.compiled && r.attempts <= 1);

  const lines: string[] = [];
  lines.push("## Test Suite Run Report");
  if (opts.milestone) lines.push(`- Milestone: ${opts.milestone}`);
  if (opts.model) lines.push(`- Model: ${formatModelName(opts.model)}`);
  lines.push(
    `- Compile rate: ${compiled}/${completed.length} (${Math.round((compiled / completed.length) * 100)}%)${opts.target ? ` \u2014 Target: ${opts.target}%` : ""}`,
  );
  lines.push(`- Avg attempts: ${(totalAttempts / completed.length).toFixed(1)}`);
  lines.push(`- Total time: ${formatDuration(totalDuration)}`);
  lines.push("");

  if (grouped.length > 0) {
    lines.push("### Error Patterns");
    for (const { category, count } of grouped) {
      lines.push(`- ${CATEGORY_LABELS[category]}: ${count}x (${Math.round((count / allErrors.length) * 100)}%)`);
    }
    lines.push("");
  }

  if (failed.length > 0) {
    lines.push(`### Failed Apps (${failed.length})`);
    for (const r of failed) {
      lines.push(
        `**${r.idea.title}** [${r.idea.category}] \u2014 ${r.attempts} attempt${r.attempts !== 1 ? "s" : ""}, ${formatDuration(r.durationMs)}`,
      );
      if (r.compilerErrors.length > 0) {
        for (const e of r.compilerErrors.slice(0, 5)) {
          lines.push(`  - ${e}`);
        }
        if (r.compilerErrors.length > 5) {
          lines.push(`  - ... +${r.compilerErrors.length - 5} more`);
        }
      }
      if (r.errorMessage) lines.push(`  Error: ${r.errorMessage}`);
      if (r.designRating || r.functionalityRating)
        lines.push(`  Ratings: Design ${r.designRating ?? "\u2014"}/5, Function ${r.functionalityRating ?? "\u2014"}/5`);
      if (r.notes) lines.push(`  Notes: ${r.notes}`);
      lines.push("");
    }
  }

  if (autoFixed.length > 0) {
    lines.push("### Auto-fixed (succeeded after retries)");
    for (const r of autoFixed) {
      const extras: string[] = [];
      if (r.designRating || r.functionalityRating) extras.push(`D:${r.designRating ?? "-"}/5 F:${r.functionalityRating ?? "-"}/5`);
      if (r.notes) extras.push(`"${r.notes}"`);
      lines.push(`- ${r.idea.title}: ${r.attempts} attempts${extras.length ? ` — ${extras.join(", ")}` : ""}`);
    }
    lines.push("");
  }

  if (cleanPasses.length > 0) {
    lines.push("### Clean passes (1st attempt)");
    for (const r of cleanPasses) {
      const extras: string[] = [];
      if (r.designRating || r.functionalityRating) extras.push(`D:${r.designRating ?? "-"}/5 F:${r.functionalityRating ?? "-"}/5`);
      if (r.notes) extras.push(`"${r.notes}"`);
      lines.push(`- ${r.idea.title}${extras.length ? ` — ${extras.join(", ")}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateResultCopy(result: TestResult): string {
  const lines: string[] = [];
  lines.push(`App: ${result.idea.title} [${result.idea.category}]`);
  lines.push(`Status: ${result.status} | Attempts: ${result.attempts} | Duration: ${formatDuration(result.durationMs)}`);
  if (result.model) lines.push(`Model: ${formatModelName(result.model)}`);
  if (result.compilerErrors.length > 0) {
    lines.push(`Errors (${result.compilerErrors.length}):`);
    for (const e of result.compilerErrors.slice(0, 10)) {
      lines.push(`  - ${e}`);
    }
    if (result.compilerErrors.length > 10) {
      lines.push(`  ... +${result.compilerErrors.length - 10} more`);
    }
  }
  if (result.errorMessage) lines.push(`Error: ${result.errorMessage}`);
  if (result.designRating || result.functionalityRating)
    lines.push(`Ratings: Design ${result.designRating ?? "\u2014"}/5, Function ${result.functionalityRating ?? "\u2014"}/5`);
  if (result.notes) lines.push(`Notes: ${result.notes}`);
  return lines.join("\n");
}

/* ────────────────────────── NDJSON Stream Reader ────────────────────────── */

async function readNDJSONStream(
  res: Response,
  onEvent?: (event: Record<string, unknown>) => void,
  opts?: { signal?: AbortSignal; shouldAbort?: () => boolean },
): Promise<{ done: Record<string, unknown> | null }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const abortError = new Error(ABORTED_MSG);

  function abortPromise(): Promise<never> {
    if (!opts?.signal) return new Promise<never>(() => {});
    if (opts.signal.aborted) return Promise.reject(abortError);
    return new Promise<never>((_, reject) => {
      opts.signal!.addEventListener("abort", () => reject(abortError), { once: true });
    });
  }

  const abortIfNeeded = () => {
    if (opts?.signal?.aborted || opts?.shouldAbort?.()) throw abortError;
  };

  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: Record<string, unknown> | null = null;

  try {
    while (true) {
      abortIfNeeded();
      const { done, value } = await Promise.race([reader.read(), abortPromise()]);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          abortIfNeeded();
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
        abortIfNeeded();
        const obj = JSON.parse(buffer);
        onEvent?.(obj);
        if (obj.type === "done") donePayload = obj;
      } catch { /* partial line */ }
    }
  } finally {
    try { reader.cancel(); } catch { /* ignore */ }
  }

  return { done: donePayload };
}

/* ────────────────────────── Build Job Poller ────────────────────────── */

const ABORTED_MSG = "TEST_SUITE_ABORTED";

async function pollBuildJob(
  jobId: string,
  onJobUpdate?: (job: Record<string, unknown>, attempts: number) => void,
  shouldAbort?: () => boolean,
): Promise<{ finalJob: Record<string, unknown>; attempts: number }> {
  const POLL_INTERVAL = 3000;
  const MAX_POLL_TIME = 20 * 60 * 1000;
  const MAX_QUEUED_TIME = 2 * 60 * 1000;
  const start = Date.now();
  let attempts = 1;
  let currentId = jobId;
  let queuedSince = Date.now();
  let wasEverPickedUp = false;

  while (Date.now() - start < MAX_POLL_TIME) {
    if (shouldAbort?.()) throw new Error(ABORTED_MSG);

    const res = await fetch(`/api/build-jobs/${currentId}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          `Build job not found (404). This usually means the server restarted or the job store was cleared. Re-run this entry to generate a new build job. (jobId=${currentId})`
        );
      }
      throw new Error(`Poll failed: ${res.status}`);
    }
    const { job } = await res.json();

    if (job.status === "queued" && !wasEverPickedUp) {
      if (Date.now() - queuedSince > MAX_QUEUED_TIME) {
        throw new Error("No Mac runner available — build job stuck in queue for 2 minutes. Start the Mac runner (npm run mac-runner) and retry.");
      }
    } else {
      wasEverPickedUp = true;
    }

    if (job.status === "succeeded") {
      onJobUpdate?.(job, attempts);
      return { finalJob: job, attempts };
    }

    if (job.status === "failed") {
      if (job.nextJobId) {
        currentId = job.nextJobId;
        attempts++;
        queuedSince = Date.now();
        wasEverPickedUp = false;
        onJobUpdate?.({ ...job, status: "auto-fixing" }, attempts);
        continue;
      }
      if (job.autoFixInProgress) {
        onJobUpdate?.({ ...job, status: "auto-fixing" }, attempts);
        if (shouldAbort?.()) throw new Error(ABORTED_MSG);
        await sleep(POLL_INTERVAL);
        continue;
      }
      onJobUpdate?.(job, attempts);
      return { finalJob: job, attempts };
    }

    onJobUpdate?.(job, attempts);
    if (shouldAbort?.()) throw new Error(ABORTED_MSG);
    await sleep(POLL_INTERVAL);
  }

  throw new Error("Build job timed out after 20 minutes");
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

/* ────────────────────────── Live Timer ────────────────────────── */

function LiveTimer({ startedAt, className }: { startedAt: number; className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className={className ?? "text-xs tabular-nums text-[var(--text-tertiary)]"}>
      {formatDuration(Date.now() - startedAt)}
    </span>
  );
}

function LiveEventList({ events }: { events: Array<{ at: number; msg: string }> }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const last = events.slice(-10);
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)]/40 p-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Live updates</p>
      <div className="space-y-1">
        {last.map((e, idx) => (
          <div key={`${e.at}-${idx}`} className="flex items-start gap-2">
            <span className="shrink-0 w-[68px] text-[10px] tabular-nums text-[var(--text-tertiary)]">
              {new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="min-w-0 text-xs text-[var(--text-secondary)] break-words">{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── Result Row ────────────────────────── */

async function downloadXcodeZip(
  projectId: string,
  projectName: string,
  projectFiles: Array<{ path: string; content: string }>,
  developmentTeam?: string,
): Promise<void> {
  const pascalName = toPascalCase(projectName);
  const res = await fetch(`/api/projects/${projectId}/export-xcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: projectFiles,
      projectName: pascalName,
      bundleId: "com.vibetree.test",
      ...(developmentTeam ? { developmentTeam } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pascalName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function ResultRow({
  result,
  index,
  onRerun,
  onExclude,
  onToggleSelect,
  onUpdate,
  onCancel,
  running,
}: {
  result: TestResult;
  index: number;
  onRerun?: () => void;
  onExclude?: () => void;
  onToggleSelect?: () => void;
  onUpdate?: (updates: Partial<TestResult>) => void;
  onCancel?: () => void;
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [xcodeLoading, setXcodeLoading] = useState(false);
  const [xcodeError, setXcodeError] = useState<string | null>(null);
  const [runOnDeviceLoading, setRunOnDeviceLoading] = useState(false);
  const [runOnDeviceError, setRunOnDeviceError] = useState<string | null>(null);
  const [runOnDeviceQueued, setRunOnDeviceQueued] = useState(false);
  const [copied, setCopied] = useState(false);
  const isActive = result.status === "generating" || result.status === "building" || result.status === "auto-fixing";

  return (
    <article
      data-test-index={index}
      className={`rounded-[var(--radius-lg)] border p-4 transition-all duration-[var(--transition-normal)] ${
        result.excluded
          ? "border-[var(--border-subtle)] bg-[var(--background-tertiary)]/50 opacity-75"
          : isActive
            ? "border-[var(--button-primary-bg)] bg-[var(--background-secondary)] ring-1 ring-[var(--button-primary-bg)]/30"
            : "border-[var(--border-default)] bg-[var(--background-secondary)] hover:border-[var(--border-subtle)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!running && onToggleSelect && (
            <button
              type="button"
              onClick={onToggleSelect}
              className="shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-default)]"
              title={result.selected !== false ? "Deselect this app (will not run when you click Run)" : "Select this app to include in the next run"}
              aria-label={result.selected !== false ? "Deselect from build" : "Select for build"}
            >
              {result.selected !== false ? (
                <CheckSquare className="h-5 w-5 text-[var(--primary-default)]" aria-hidden />
              ) : (
                <Square className="h-5 w-5" aria-hidden />
              )}
            </button>
          )}
          {result.excluded ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-[var(--background-tertiary)] text-[var(--text-tertiary)]">
              Excluded
            </span>
          ) : (
            <StatusBadge status={result.status} />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {result.idea.title}
              {result.model && (
                <span className="ml-2 inline-flex items-center rounded-full bg-[var(--background-tertiary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                  {result.model === "opus-4.6" ? "Opus" : result.model === "sonnet-4.6" ? "Sonnet" : result.model}
                </span>
              )}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {result.idea.category}
              {isActive && result.liveStatus && (
                <span className="ml-2 text-blue-400">{result.liveStatus}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {result.attempts > 0 && (
            <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
              {result.attempts} attempt{result.attempts !== 1 ? "s" : ""}
            </span>
          )}
          {isActive && result.startedAt ? (
            <LiveTimer startedAt={result.startedAt} />
          ) : result.durationMs > 0 ? (
            <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
              {formatDuration(result.durationMs)}
            </span>
          ) : null}
          {result.generationMs !== undefined && result.generationMs > 0 && (
            <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
              gen {formatDuration(result.generationMs)}
            </span>
          )}
          {result.buildMs !== undefined && result.buildMs > 0 && (
            <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
              build {formatDuration(result.buildMs)}
            </span>
          )}
          {result.fileCount > 0 && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {result.fileCount} files
            </span>
          )}

          {result.status === "succeeded" && result.projectId && (
            <span className="inline-flex items-center gap-1.5">
              <button
                type="button"
                disabled={runOnDeviceLoading}
                onClick={async () => {
                  setRunOnDeviceError(null);
                  setRunOnDeviceQueued(false);
                  setRunOnDeviceLoading(true);
                  try {
                    let teamId = "";
                    try {
                      const ud = JSON.parse(localStorage.getItem("vibetree-universal-defaults") || "{}");
                      teamId = (ud.teamId || "").trim();
                    } catch {}
                    let files = result.projectFiles?.length ? result.projectFiles : undefined;
                    if (!files?.length) {
                      const filesRes = await fetch(`/api/projects/${result.projectId}/files`);
                      if (filesRes.ok) {
                        const filesData = (await filesRes.json()) as { files?: Array<{ path: string; content: string }> };
                        if (filesData.files?.length) files = filesData.files;
                      }
                    }
                    if (files?.length) {
                      await fetch(`/api/projects/${result.projectId}/files`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ files }),
                      }).catch(() => {});
                    }
                    const res = await fetch(`/api/projects/${result.projectId}/build-install`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        files: files?.length ? files : undefined,
                        projectName: toPascalCase(result.idea.title),
                        bundleId: "com.vibetree.test",
                        developmentTeam: teamId || undefined,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error((data as { error?: string }).error ?? "Install request failed");
                    }
                    if (!data?.job?.id) throw new Error("No job returned");
                    setRunOnDeviceError(null);
                    setRunOnDeviceQueued(true);
                    setTimeout(() => setRunOnDeviceQueued(false), 3000);
                  } catch (e) {
                    setRunOnDeviceError(e instanceof Error ? e.message : "Install failed");
                  } finally {
                    setRunOnDeviceLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-2 py-1 text-xs font-medium text-[var(--button-primary-text)] transition-colors hover:opacity-90 disabled:opacity-60"
                title="Build and install this app on your iPhone (Mac runner must be running)"
              >
                {runOnDeviceLoading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Smartphone className="h-3 w-3" aria-hidden />}
                Run on iPhone
              </button>
              {runOnDeviceQueued && (
                <span className="text-xs text-[var(--semantic-success)]">Queued</span>
              )}
              {runOnDeviceError && (
                <span className="max-w-[220px] truncate text-xs text-[var(--semantic-error)]" title={runOnDeviceError}>
                  {runOnDeviceError.includes("No files to build")
                    ? "No files — use Xcode button or re-run app once"
                    : runOnDeviceError}
                </span>
              )}
              <button
                type="button"
                disabled={xcodeLoading}
                onClick={async () => {
                  setXcodeError(null);
                  setXcodeLoading(true);
                  try {
                    let teamId: string | undefined;
                    try {
                      const ud = JSON.parse(localStorage.getItem("vibetree-universal-defaults") || "{}");
                      teamId = ud.teamId || undefined;
                    } catch {}
                    if (result.projectFiles?.length) {
                      await fetch(`/api/projects/${result.projectId}/files`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ files: result.projectFiles }),
                      }).catch(() => {});
                      await downloadXcodeZip(
                        result.projectId!,
                        result.idea.title,
                        result.projectFiles,
                        teamId,
                      );
                    } else {
                      const url = `/api/projects/${result.projectId}/export-xcode`;
                      const res = await fetch(url);
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: res.statusText }));
                        throw new Error((err as { error?: string }).error ?? "Export failed");
                      }
                      const blob = await res.blob();
                      const downloadUrl = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = downloadUrl;
                      a.download = `${toPascalCase(result.idea.title)}.zip`;
                      a.click();
                      URL.revokeObjectURL(downloadUrl);
                    }
                  } catch (e) {
                    setXcodeError(e instanceof Error ? e.message : "Download failed");
                  } finally {
                    setXcodeLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-2 py-1 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)] disabled:opacity-60"
              >
                {xcodeLoading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Download className="h-3 w-3" aria-hidden />}
                Xcode
              </button>
              {xcodeError && (
                <span className="max-w-[220px] truncate text-xs text-[var(--semantic-error)]" title={xcodeError}>
                  {xcodeError.includes("No Swift files") || xcodeError.includes("No files")
                    ? "No files — re-run this app once to generate"
                    : xcodeError}
                </span>
              )}
            </span>
          )}

          {!running && onExclude && (
            <button
              type="button"
              onClick={onExclude}
              className="rounded-[var(--radius-md)] px-2 py-1 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              title={result.excluded ? "Include in stats and resume" : "Exclude from stats and resume (e.g. test/env failure)"}
            >
              {result.excluded ? "Include" : "Exclude"}
            </button>
          )}

          {!running && result.status !== "pending" && !result.excluded && onRerun && (
            <button
              type="button"
              onClick={onRerun}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              title="Re-run this app"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}

          {result.status !== "pending" && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generateResultCopy(result));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              title="Copy result details"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--semantic-success)]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}

          {(result.status === "succeeded" || result.status === "failed" || result.status === "error") && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          {isActive && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[var(--radius-md)] px-2 py-1 text-xs font-medium text-[var(--semantic-error)] transition-colors hover:bg-[var(--badge-error)]/10"
              title="Cancel this entry"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Always-visible error summary for failed/error entries */}
      {!expanded && (result.status === "failed" || result.status === "error") && (result.errorMessage || result.compilerErrors.length > 0) && (
        <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--badge-error)]/30 bg-[var(--badge-error)]/10 px-3 py-2">
          {result.errorMessage && (
            <p className="text-xs font-medium text-[var(--semantic-error)]">{result.errorMessage}</p>
          )}
          {result.compilerErrors.length > 0 && (
            <>
              <p className="font-mono text-xs text-[var(--text-secondary)] truncate">{result.compilerErrors[0]}</p>
              {result.compilerErrors.length > 1 && (
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">+{result.compilerErrors.length - 1} more errors</p>
              )}
            </>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-3 border-t border-[var(--border-default)] pt-3 space-y-3">
          {result.liveEvents && result.liveEvents.length > 0 && (
            <LiveEventList events={result.liveEvents} />
          )}
          {result.errorMessage && (
            <p className="text-xs text-[var(--semantic-error)]">{result.errorMessage}</p>
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

          {(result.status === "succeeded" || result.status === "failed") && onUpdate && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">Design</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => onUpdate({ designRating: result.designRating === star ? undefined : star })}
                        className={`text-base leading-none transition-colors ${(result.designRating ?? 0) >= star ? "text-yellow-400" : "text-[var(--text-tertiary)]/30 hover:text-yellow-400/50"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {result.designRating != null && (
                    <span className="text-xs tabular-nums text-[var(--text-tertiary)]">{result.designRating}/5</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">Function</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => onUpdate({ functionalityRating: result.functionalityRating === star ? undefined : star })}
                        className={`text-base leading-none transition-colors ${(result.functionalityRating ?? 0) >= star ? "text-yellow-400" : "text-[var(--text-tertiary)]/30 hover:text-yellow-400/50"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {result.functionalityRating != null && (
                    <span className="text-xs tabular-nums text-[var(--text-tertiary)]">{result.functionalityRating}/5</span>
                  )}
                </div>
              </div>
              <textarea
                placeholder={"What's broken or off? e.g.\n• menu overlaps the start button • can't tap settings • navigation doesn't go back • slider covers the text"}
                value={result.notes ?? ""}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-primary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]/50 focus:border-[var(--button-primary-bg)] focus:outline-none resize-y"
              />
              {(result.issueTags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {result.issueTags!.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
                    >
                      {tag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ────────────────────────── Summary Panel ────────────────────────── */

function SummaryPanel({
  results,
  target,
  running,
  runStartTime,
  onStop,
  onPauseAfterNext,
  pauseAfterNext,
  errorsExpanded,
  onToggleErrors,
}: {
  results: TestResult[];
  target?: number;
  running?: boolean;
  runStartTime?: number | null;
  onStop?: () => void;
  onPauseAfterNext?: () => void;
  pauseAfterNext?: boolean;
  errorsExpanded: boolean;
  onToggleErrors: () => void;
}) {
  const completed = results.filter(
    (r) => !r.excluded && (r.status === "succeeded" || r.status === "failed" || r.status === "error"),
  );
  if (completed.length === 0) return null;

  const compiled = completed.filter((r) => r.compiled).length;
  const totalAttempts = completed.reduce((s, r) => s + r.attempts, 0);
  const totalDuration = completed.reduce((s, r) => s + r.durationMs, 0);
  const allErrors = completed.flatMap((r) => r.compilerErrors);
  const grouped = groupErrors(allErrors);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Compile rate</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${compiled === completed.length ? "text-[var(--semantic-success)]" : compiled > 0 ? "text-[var(--semantic-warning)]" : "text-[var(--semantic-error)]"}`}>
            {compiled}/{completed.length}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Pass rate</p>
          {(() => {
            const rate = completed.length > 0 ? Math.round((compiled / completed.length) * 100) : 0;
            const t = target ?? 70;
            const rateColor = rate >= t + 5 ? "text-[var(--semantic-success)]" : rate >= t - 5 ? "text-yellow-400" : "text-[var(--semantic-error)]";
            return (
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${rateColor}`}>
                {rate}%
                {target !== undefined && (
                  <span className="ml-1 text-sm font-normal text-[var(--text-tertiary)]">/ {target}%</span>
                )}
              </p>
            );
          })()}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Avg attempts</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {completed.length > 0 ? (totalAttempts / completed.length).toFixed(1) : "—"}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {running ? "Elapsed" : "Total time"}
          </p>
          {running && runStartTime ? (
            <LiveTimer
              startedAt={runStartTime}
              className="mt-1 block text-2xl font-semibold tabular-nums text-[var(--text-primary)]"
            />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
              {formatDuration(totalDuration)}
            </p>
          )}
        </div>
      </div>

      {running && (onStop || onPauseAfterNext) && (
        <div className="flex items-center gap-2">
          {onStop && (
            <Button variant="destructive" onClick={onStop} className="gap-1.5 px-3 py-1.5 min-h-0 text-xs">
              <Square className="h-3.5 w-3.5" aria-hidden />
              Stop
            </Button>
          )}
          {onPauseAfterNext && (
            <Button
              variant="secondary"
              onClick={onPauseAfterNext}
              className={`gap-1.5 px-3 py-1.5 min-h-0 text-xs ${pauseAfterNext ? "ring-1 ring-[var(--semantic-warning)]" : ""}`}
            >
              <Pause className="h-3.5 w-3.5" aria-hidden />
              {pauseAfterNext ? "Pausing after this build…" : "Pause after next"}
            </Button>
          )}
        </div>
      )}

      {grouped.length > 0 && (
        <div>
          <button
            type="button"
            onClick={onToggleErrors}
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] px-1 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
          >
            <span>Error patterns ({allErrors.length})</span>
            {errorsExpanded ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
          </button>
          {errorsExpanded && (
            <div className="mt-1.5 space-y-1">
              {grouped.map(({ category, count }) => (
                <div key={category} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-right font-semibold tabular-nums text-[var(--text-primary)]">{count}x</span>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
                    <div
                      className="h-full rounded-full bg-[var(--semantic-error)] transition-all"
                      style={{ width: `${Math.min(100, (count / allErrors.length) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[var(--text-secondary)]">{CATEGORY_LABELS[category]}</span>
                </div>
              ))}
            </div>
          )}
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
  const canCompare = completedRuns.length >= 2;

  const options: SelectOption[] = completedRuns.map((r) => ({
    value: r.id,
    label: `${formatTimestamp(r.timestamp)} \u2014 ${r.model === "opus-4.6" ? "Opus 4.6" : "Sonnet 4.6"}${r.milestone ? ` [${MILESTONE_LABELS[r.milestone] ?? r.milestone}]` : ""} (${r.summary.compileRate}%)`,
  }));

  const a = completedRuns.find((r) => r.id === runA);
  const b = completedRuns.find((r) => r.id === runB);

  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4${!canCompare ? " opacity-60" : ""}`}>
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[var(--button-primary-bg)]" aria-hidden />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Compare runs</h3>
        {completedRuns.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-[var(--text-tertiary)]">
            {completedRuns.length} saved run{completedRuns.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {!canCompare ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--background-tertiary)]/50 px-4 py-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {completedRuns.length === 0
              ? "No completed runs yet. Run a milestone to see results here."
              : "Complete one more run to compare side-by-side. Run the same milestone again after making system improvements, or run a different milestone to see how compile rates change."}
          </p>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            Each completed run is saved automatically. Select any two runs to see which apps improved or regressed.
          </p>
        </div>
      ) : (
        <>
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
              {Array.from(
                new Set<string>([
                  ...a.results.map((r) => r.title),
                  ...b.results.map((r) => r.title),
                ])
              )
                .sort((x, y) => x.localeCompare(y))
                .map((title) => {
                const ra = a.results.find((r) => r.title === title);
                const rb = b.results.find((r) => r.title === title);
                const aPass = ra?.compiled ?? false;
                const bPass = rb?.compiled ?? false;
                const improved = !aPass && bPass;
                const regressed = aPass && !bPass;

                return (
                  <tr key={title} className="border-b border-[var(--border-default)]/50">
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{title}</td>
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
        </>
      )}
    </section>
  );
}

const TEST_SUITE_STORAGE_KEY = "vibetree-test-suite-state";
const CONCURRENCY_STORAGE_KEY = "vibetree-test-suite-concurrency";

function makeInitialResults(ideas: AppIdea[]): TestResult[] {
  return ideas.map((idea) => ({
    idea,
    status: "pending" as const,
    attempts: 0,
    compilerErrors: [],
    durationMs: 0,
    fileCount: 0,
    selected: true,
  }));
}

function loadPersistedState(storageKey: string = TEST_SUITE_STORAGE_KEY): {
  model: string;
  results: TestResult[];
  currentRunId: string | null;
  completedCount: number;
  running: boolean;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      model?: string;
      results?: unknown[];
      currentRunId?: string | null;
      completedCount?: number;
      running?: boolean;
    };
    if (!data || !Array.isArray(data.results) || data.results.length < 1) return null;
    const results: TestResult[] = data.results.map((r: unknown, i: number) => {
      const row = r as Record<string, unknown>;
      const idea = (row.idea as AppIdea) ?? {
        title: `Idea ${i + 1}`,
        prompt: "",
        category: "Misc",
        tier: "medium" as const,
      };
      return {
        idea,
        status: (row.status as TestResultStatus) ?? "pending",
        projectId: row.projectId as string | undefined,
        buildJobId: row.buildJobId as string | undefined,
        compiled: row.compiled as boolean | undefined,
        attempts: (row.attempts as number) ?? 0,
        compilerErrors: Array.isArray(row.compilerErrors) ? (row.compilerErrors as string[]) : [],
        screenshotUrl: row.screenshotUrl as string | undefined,
        durationMs: (row.durationMs as number) ?? 0,
        generationMs: typeof row.generationMs === "number" ? (row.generationMs as number) : undefined,
        buildMs: typeof row.buildMs === "number" ? (row.buildMs as number) : undefined,
        fileCount: (row.fileCount as number) ?? 0,
        errorMessage: row.errorMessage as string | undefined,
        buildResultId: row.buildResultId as string | undefined,
        projectFiles: Array.isArray(row.projectFiles) ? (row.projectFiles as Array<{ path: string; content: string }>) : undefined,
        excluded: (row.excluded as boolean) ?? false,
        selected: (row.selected as boolean) ?? true,
        model: (row.model as string) || undefined,
        designRating: typeof row.designRating === "number" ? (row.designRating as number) : undefined,
        functionalityRating: typeof row.functionalityRating === "number" ? (row.functionalityRating as number) : undefined,
        notes: typeof row.notes === "string" ? (row.notes as string) : undefined,
        issueTags: Array.isArray(row.issueTags) ? (row.issueTags as string[]) : undefined,
      };
    });
    const computedCompletedCount = results.filter((r) => !r.excluded && r.status !== "pending").length;
    return {
      model: typeof data.model === "string" ? data.model : "sonnet-4.6",
      results,
      currentRunId: data.currentRunId ?? null,
      completedCount: computedCompletedCount,
      running: false,
    };
  } catch {
    return null;
  }
}

function savePersistedState(
  state: {
    model: string;
    results: TestResult[];
    currentRunId: string | null;
    completedCount: number;
    running: boolean;
  },
  storageKey: string = TEST_SUITE_STORAGE_KEY,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // quota or disabled localStorage
  }
}

/* ────────────────────────── Main Page ────────────────────────── */

export default function TestSuitePage() {
  const [model, setModel] = useState("sonnet-4.6");
  const [ideas, setIdeas] = useState<AppIdea[]>(DEFAULT_IDEAS);
  const [results, setResults] = useState<TestResult[]>(makeInitialResults(DEFAULT_IDEAS));
  const [running, setRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [pastRuns, setPastRuns] = useState<SavedRun[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [syncingActive, setSyncingActive] = useState(false);
  const [pauseAfterNext, setPauseAfterNext] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(true);
  const abortRef = useRef(false);
  const pauseAfterNextRef = useRef(false);
  const entryControllersRef = useRef<Map<number, AbortController>>(new Map());
  const restoredRef = useRef(false);
  const hydratedRef = useRef(false);
  const lastScrolledIdx = useRef(-1);

  const [activeMilestone, setActiveMilestone] = useState("m1-baseline");
  const [milestoneTarget, setMilestoneTarget] = useState(70);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [milestoneTabs, setMilestoneTabs] = useState<Array<{ id: string; label: string; count: number; target: number; description: string }>>([]);
  const [copiedReport, setCopiedReport] = useState(false);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [runElapsed, setRunElapsed] = useState(0);
  const [concurrency, setConcurrency] = useState<1 | 2>(() => {
    if (typeof window === "undefined") return 1;
    try { return localStorage.getItem(CONCURRENCY_STORAGE_KEY) === "2" ? 2 : 1; } catch { return 1; }
  });
  const concurrencyRef = useRef(concurrency);

  function setConcurrencyAndSave(n: 1 | 2) {
    setConcurrency(n);
    concurrencyRef.current = n;
    try { localStorage.setItem(CONCURRENCY_STORAGE_KEY, String(n)); } catch {}
  }

  const msKey = useCallback((ms: string) => `${TEST_SUITE_STORAGE_KEY}-${ms}`, []);

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

  useEffect(() => {
    fetch("/api/test-suite/milestones")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.milestones)) {
          setMilestoneTabs(
            data.milestones.map((m: { id: string; label: string; count: number; target: number; description: string }) => ({
              id: m.id,
              label: m.label,
              count: m.count,
              target: m.target,
              description: m.description,
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const persisted =
      loadPersistedState(msKey(activeMilestone)) || loadPersistedState();
    if (persisted) {
      setModel(persisted.model);
      setIdeas(persisted.results.map((r) => r.idea));
      setResults(persisted.results);
      setCurrentRunId(persisted.currentRunId);
      setCompletedCount(persisted.completedCount);
      setRunning(persisted.running);
    }
    hydratedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    savePersistedState(
      { model, results, currentRunId, completedCount, running },
      msKey(activeMilestone),
    );
  }, [model, results, currentRunId, completedCount, running, activeMilestone, msKey]);

  useEffect(() => {
    setCompletedCount(results.filter((r) => !r.excluded && r.status !== "pending").length);
  }, [results]);

  useEffect(() => {
    if (!running || !runStartTime) return;
    const interval = setInterval(() => {
      setRunElapsed(Date.now() - runStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [running, runStartTime]);

  useEffect(() => {
    if (!running && !syncingActive) { lastScrolledIdx.current = -1; return; }
    const activeIdx = results.findIndex(
      (r) => r.status === "generating" || r.status === "building" || r.status === "auto-fixing",
    );
    if (activeIdx >= 0 && activeIdx !== lastScrolledIdx.current) {
      lastScrolledIdx.current = activeIdx;
      const el = document.querySelector(`[data-test-index="${activeIdx}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [results, running, syncingActive]);

  const syncTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const syncToBuildLog = useCallback((buildResultId: string, updates: Partial<TestResult>, index?: number) => {
    const payload: Record<string, unknown> = {};
    if (updates.notes !== undefined) payload.userNotes = updates.notes;
    if (updates.designRating !== undefined) payload.userDesignScore = updates.designRating ?? null;
    if (updates.functionalityRating !== undefined) payload.userFunctionalScore = updates.functionalityRating ?? null;
    if (Object.keys(payload).length === 0) return;

    const doSync = () => {
      fetch(`/api/build-results/${buildResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((json) => {
          if (json?.result?.issueTags && index !== undefined) {
            setResults((prev) => {
              const next = [...prev];
              next[index] = { ...next[index], issueTags: json.result.issueTags };
              return next;
            });
          }
        })
        .catch(() => {});
    };

    if (index !== undefined && updates.notes !== undefined) {
      clearTimeout(syncTimers.current[index]);
      syncTimers.current[index] = setTimeout(doSync, 800);
    } else {
      doSync();
    }
  }, []);

  const updateResult = useCallback((index: number, updates: Partial<TestResult>) => {
    const hasQAField = "notes" in updates || "designRating" in updates || "functionalityRating" in updates;

    setResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };

      if (hasQAField && next[index].buildResultId) {
        syncToBuildLog(next[index].buildResultId!, updates, index);
      }

      return next;
    });
  }, [syncToBuildLog]);

  const pushLiveEvent = useCallback((index: number, msg: string) => {
    setResults((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const events = (cur.liveEvents ?? []).concat([{ at: Date.now(), msg }]).slice(-60);
      next[index] = { ...cur, liveEvents: events };
      return next;
    });
  }, []);

  const syncActiveBuilds = useCallback(async () => {
    if (syncingActive) return;
    const active = results
      .map((r, i) => ({ r, i }))
      .filter(
        ({ r }) =>
          !r.excluded &&
          (r.status === "building" || r.status === "auto-fixing") &&
          typeof r.buildJobId === "string" &&
          r.buildJobId.length > 0
      );
    if (active.length === 0) return;

    setSyncingActive(true);
    try {
      for (const { r, i } of active) {
        updateResult(i, { startedAt: Date.now(), liveStatus: "Reconnecting to build job..." });
        pushLiveEvent(i, "Reconnecting to build job…");
        try {
          let lastLogHint = "";
          const { finalJob, attempts } = await pollBuildJob(
            r.buildJobId!,
            (job, att) => {
              const lastLog = Array.isArray((job as { logs?: unknown }).logs)
                ? (job as { logs: string[] }).logs[(job as { logs: string[] }).logs.length - 1]
                : undefined;
              const logHint = lastLog ? summarizeLogLine(lastLog) : "";
              const phase: TestResultStatus = att > 1 ? "auto-fixing" : "building";
              const statusText = phase === "auto-fixing" ? `Auto-fix attempt ${att}...` : "Compiling in Xcode...";
              const nextLive = logHint ? `${statusText} • ${logHint}` : statusText;
              updateResult(i, {
                status: phase,
                attempts: att,
                liveStatus: nextLive,
              });
              if (logHint && logHint !== lastLogHint) {
                lastLogHint = logHint;
                pushLiveEvent(i, logHint);
              }
            },
          );

          const compiled = finalJob.status === "succeeded";
          const compilerErrors = (finalJob.compilerErrors as string[]) ?? [];
          const jobRequest = finalJob.request as { files?: Array<{ path: string; content: string }> } | undefined;
          const builtFiles = (compiled && jobRequest?.files?.length ? jobRequest.files : undefined) ?? undefined;

          updateResult(i, {
            status: compiled ? "succeeded" : "failed",
            compiled,
            attempts,
            compilerErrors,
            ...(builtFiles?.length ? { projectFiles: builtFiles } : {}),
            liveStatus: undefined,
            startedAt: undefined,
          });
          pushLiveEvent(i, compiled ? "Build succeeded." : "Build failed.");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          updateResult(i, {
            status: "error",
            compiled: false,
            errorMessage: msg,
            liveStatus: undefined,
            startedAt: undefined,
          });
          pushLiveEvent(i, `Error: ${msg}`);
        }
      }
    } finally {
      setSyncingActive(false);
    }
  }, [pushLiveEvent, results, syncingActive, updateResult]);

  // On load, reset any orphaned "generating" entries to error (no way to reconnect a stream).
  // Only reconnect "building/auto-fixing" entries that have a buildJobId.
  const cleanedOrphansRef = useRef(false);
  useEffect(() => {
    if (cleanedOrphansRef.current) return;
    if (!hydratedRef.current) return;
    cleanedOrphansRef.current = true;
    setResults((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.status === "generating") {
          changed = true;
          return { ...r, status: "error" as TestResultStatus, errorMessage: "Generation interrupted (page reload). Re-run this entry.", liveStatus: undefined, startedAt: undefined };
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect to in-flight build jobs (building/auto-fixing with a buildJobId).
  useEffect(() => {
    if (running) return;
    if (syncingActive) return;
    const hasActive = results.some(
      (r) => !r.excluded && (r.status === "building" || r.status === "auto-fixing") && r.buildJobId
    );
    if (!hasActive) return;
    syncActiveBuilds();
  }, [results, running, syncingActive, syncActiveBuilds]);

  const switchMilestone = useCallback(
    async (newMilestone: string) => {
      if (running || newMilestone === activeMilestone) return;

      savePersistedState(
        { model, results, currentRunId, completedCount, running },
        msKey(activeMilestone),
      );

      setMilestoneLoading(true);
      try {
        const res = await fetch(`/api/test-suite/milestones?id=${newMilestone}`);
        const data = await res.json();
        const config = data.milestone;

        if (config?.ideas?.length) {
          setMilestoneTarget(config.target ?? 70);

          const saved = loadPersistedState(msKey(newMilestone));

          if (saved && saved.results.length > 0) {
            setIdeas(saved.results.map((r) => r.idea));
            setResults(saved.results);
            setCurrentRunId(saved.currentRunId);
            setCompletedCount(saved.completedCount);
            setModel(saved.model);
          } else {
            const newIdeas = config.ideas as AppIdea[];
            setIdeas(newIdeas);
            setResults(makeInitialResults(newIdeas));
            setCurrentRunId(null);
            setCompletedCount(0);
          }
        }
      } catch {
        /* ignore fetch error */
      } finally {
        setMilestoneLoading(false);
      }

      setActiveMilestone(newMilestone);
    },
    [activeMilestone, model, results, currentRunId, completedCount, running, msKey],
  );

  const runSingleTest = useCallback(
    async (index: number, config: RunConfig, getAbort: () => boolean): Promise<TestResult> => {
      const idea = ideas[index] ?? DEFAULT_IDEAS[index];
      const t0 = Date.now();

      try {
        if (getAbort()) throw new Error(ABORTED_MSG);
        const entryStart = Date.now();
        updateResult(index, { status: "generating", startedAt: entryStart, liveStatus: "Starting generation...", liveEvents: [] });
        pushLiveEvent(index, "Starting generation…");

        const genStart = Date.now();
        const project = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `[Test] ${idea.title}` }),
        }).then((r) => r.json());

        const projectId = project.id;
        updateResult(index, { projectId });

        const GEN_TIMEOUT_MS = 6 * 60 * 1000;
        const genController = new AbortController();
        entryControllersRef.current.set(index, genController);
        const genTimeout = setTimeout(() => {
          try {
            genController.abort();
          } catch {}
        }, GEN_TIMEOUT_MS);

        const streamRes = await fetch(`/api/projects/${projectId}/message/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: idea.prompt,
            projectType: config.projectType,
            model: config.model,
          }),
          signal: genController.signal,
        });

        if (!streamRes.ok) throw new Error(`Stream failed: ${streamRes.status}`);

        let projectFiles: Array<{ path: string; content: string }> | null = null;
        let fileCount = 0;

        let lastEventCount = 0;
        const { done } = await readNDJSONStream(
          streamRes,
          (event) => {
          if (event.type === "file") {
            fileCount = (event.count as number) ?? fileCount + 1;
            const fileName = (event.path as string)?.split("/").pop() ?? "";
            if (fileName) {
              updateResult(index, { liveStatus: `Generating ${fileName}`, fileCount });
              if (fileCount <= 3 || fileCount >= lastEventCount + 5) {
                lastEventCount = fileCount;
                pushLiveEvent(index, `Generated ${fileName}`);
              }
            }
          }
          },
          { signal: genController.signal, shouldAbort: getAbort },
        );

        clearTimeout(genTimeout);
        entryControllersRef.current.delete(index);

        if (!done) throw new Error("No 'done' event in stream");
        projectFiles = (done.projectFiles as Array<{ path: string; content: string }>) ?? null;
        if (!projectFiles?.length) throw new Error("No files generated");

        const generationMs = Date.now() - genStart;
        fileCount = projectFiles.length;
        if (getAbort()) throw new Error(ABORTED_MSG);
        updateResult(index, { status: "building", fileCount, generationMs, liveStatus: "Compiling in Xcode...", startedAt: Date.now() });
        pushLiveEvent(index, "Starting build…");

        let developmentTeam: string | undefined;
        try {
          const ud = JSON.parse(localStorage.getItem("vibetree-universal-defaults") || "{}");
          developmentTeam = ud.teamId || undefined;
        } catch {}

        const buildStart = Date.now();
        const buildRes = await fetch(`/api/projects/${projectId}/validate-xcode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: projectFiles,
            projectName: toPascalCase(idea.title),
            bundleId: "com.vibetree.test",
            autoFix: true,
            ...(developmentTeam ? { developmentTeam } : {}),
          }),
        }).then((r) => r.json());

        if (!buildRes.job?.id) throw new Error("No build job created");

        const { finalJob, attempts } = await pollBuildJob(
          buildRes.job.id,
          (() => {
            let lastLogHint = "";
            let lastPhase: TestResultStatus | "" = "";
            return (job, att) => {
              const lastLog = Array.isArray((job as { logs?: unknown }).logs)
                ? (job as { logs: string[] }).logs[(job as { logs: string[] }).logs.length - 1]
                : undefined;
              const logHint = lastLog ? summarizeLogLine(lastLog) : "";
              const phase: TestResultStatus = att > 1 ? "auto-fixing" : "building";
              const statusText = phase === "auto-fixing" ? `Auto-fix attempt ${att}...` : "Compiling in Xcode...";
              const nextLive = logHint ? `${statusText} • ${logHint}` : statusText;
              updateResult(index, {
                status: phase,
                attempts: att,
                buildJobId: buildRes.job.id,
                liveStatus: nextLive,
              });
              if (phase !== lastPhase) {
                lastPhase = phase;
                pushLiveEvent(index, phase === "auto-fixing" ? `Auto-fix started (attempt ${att}).` : "Build in progress…");
              }
              if (logHint && logHint !== lastLogHint) {
                lastLogHint = logHint;
                pushLiveEvent(index, logHint);
              }
            };
          })(),
          getAbort,
        );

        const buildMs = Date.now() - buildStart;
        const compiled = finalJob.status === "succeeded";
        const compilerErrors = (finalJob.compilerErrors as string[]) ?? [];
        const jobRequest = finalJob.request as { files?: Array<{ path: string; content: string }> } | undefined;
        const builtFiles = (compiled && jobRequest?.files?.length ? jobRequest.files : projectFiles) ?? null;

        let screenshotUrl: string | undefined;
        if (compiled) {
          await sleep(5000);
          screenshotUrl = `/api/projects/${projectId}/simulator-preview?t=${Date.now()}`;
        }

        const durationMs = Date.now() - t0;

        let buildResultId: string | undefined;
        try {
          const brRes = await fetch("/api/build-results", {
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
              skillsUsed: Array.isArray(done?.skillIds) ? done.skillIds : [],
            }),
          });
          if (brRes.ok) {
            const brJson = await brRes.json();
            buildResultId = brJson.result?.id;
          }
        } catch {}

        if (compiled && builtFiles?.length && projectId) {
          fetch(`/api/projects/${projectId}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: builtFiles }),
          }).catch(() => {});
        }

        const finalResult: Partial<TestResult> = {
          status: compiled ? "succeeded" : "failed",
          compiled,
          attempts,
          compilerErrors,
          screenshotUrl,
          durationMs,
          generationMs,
          buildMs,
          fileCount,
          model: config.model,
          buildResultId,
          liveStatus: undefined,
          startedAt: undefined,
          ...(builtFiles?.length ? { projectFiles: builtFiles } : {}),
        };

        updateResult(index, finalResult);
        pushLiveEvent(index, compiled ? "Build succeeded." : "Build failed.");

        return {
          idea,
          projectId,
          buildJobId: buildRes.job.id,
          buildResultId,
          ...finalResult,
        } as TestResult;
      } catch (err) {
        // Ensure any in-flight controller for this entry is cleared.
        entryControllersRef.current.delete(index);
        const msg = err instanceof Error ? err.message : String(err);
        const isAborted = msg === ABORTED_MSG;
        const durationMs = Date.now() - t0;
        updateResult(index, {
          status: "error",
          compiled: false,
          errorMessage: isAborted ? "Stopped by user" : msg,
          durationMs,
          liveStatus: undefined,
          startedAt: undefined,
        });
        pushLiveEvent(index, isAborted ? "Stopped by user." : `Error: ${msg}`);
        return {
          idea,
          status: "error",
          compiled: false,
          attempts: 0,
          compilerErrors: [],
          durationMs,
          fileCount: 0,
          errorMessage: isAborted ? "Stopped by user" : msg,
        };
      }
    },
    [ideas, pushLiveEvent, updateResult],
  );

  const runAllTests = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setRunStartTime(Date.now());
    setRunElapsed(0);
    const pending = results
      .map((_, i) => i)
      .filter((i) => results[i].status === "pending" && !results[i].excluded && results[i].selected !== false);
    const baseDone = results.filter((r) => !r.excluded && r.status !== "pending").length;
    setCompletedCount(baseDone);
    if (pending.length === 0) {
      setRunning(false);
      return;
    }

    const config: RunConfig = { model, projectType: "pro" };

    const createRes = await fetch("/api/test-suite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", model, milestone: activeMilestone }),
    }).then((r) => r.json());

    const runId = createRes.run?.id;
    setCurrentRunId(runId);

    const finalResults: TestResult[] = [];
    const baseResults = results.filter((r) => !r.excluded && r.status !== "pending");

    const saveProgress = async (isLast: boolean) => {
      if (!runId) return;
      const mergedByKey = new Map<string, TestResult>();
      for (const r of [...baseResults, ...finalResults]) {
        mergedByKey.set(`${r.idea.title}::${r.idea.prompt}`, r);
      }
      const merged = Array.from(mergedByKey.values());
      const summary = {
        total: merged.length,
        compiled: merged.filter((r) => r.compiled).length,
        compileRate: Math.round(
          (merged.filter((r) => r.compiled).length / merged.length) * 100,
        ),
        avgAttempts: Math.round(
          (merged.reduce((s, r) => s + r.attempts, 0) / merged.length) * 10,
        ) / 10,
        totalDurationMs: merged.reduce((s, r) => s + r.durationMs, 0),
      };
      try {
        await fetch("/api/test-suite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: runId,
            status: abortRef.current ? "stopped" : (isLast ? "completed" : "running"),
            results: merged.map((r) => ({
              title: r.idea.title,
              category: r.idea.category,
              compiled: r.compiled ?? false,
              attempts: r.attempts,
              durationMs: r.durationMs,
              projectId: r.projectId,
              buildResultId: r.buildResultId,
              errors: r.compilerErrors,
              fileCount: r.fileCount,
              model: r.model ?? config.model,
            })),
            summary,
          }),
        });
      } catch (_) {}
    };

    try {
      let cursor = 0;
      const lanes = concurrencyRef.current;

      async function worker() {
        while (cursor < pending.length) {
          if (abortRef.current || pauseAfterNextRef.current) break;
          const idx = pending[cursor++];
          if (idx === undefined) break;
          const result = await runSingleTest(idx, config, () => abortRef.current);
          finalResults.push(result);
          setCompletedCount(baseDone + finalResults.length);
          await saveProgress(cursor >= pending.length);
          if (pauseAfterNextRef.current) break;
          if (cursor < pending.length && !abortRef.current) {
            await sleep(lanes > 1 ? 500 : 2000);
          }
        }
      }

      const workers = Array.from({ length: lanes }, () => worker());
      await Promise.all(workers);

      if (pauseAfterNextRef.current) {
        pauseAfterNextRef.current = false;
        setPauseAfterNext(false);
      }
    } finally {
      setRunning(false);
      setRunStartTime(null);
      setPauseAfterNext(false);
      pauseAfterNextRef.current = false;
      loadPastRuns();
    }
  }, [ideas, model, results, runSingleTest, loadPastRuns, activeMilestone]);

  const stopRun = useCallback(() => {
    abortRef.current = true;
    for (const ctrl of entryControllersRef.current.values()) {
      try {
        ctrl.abort();
      } catch {}
    }
    entryControllersRef.current.clear();
    setRunning(false);
    setRunStartTime(null);
    setResults((prev) =>
      prev.map((r) =>
        r.status === "generating"
          ? { ...r, status: "error" as TestResultStatus, errorMessage: "Stopped by user", liveStatus: undefined, startedAt: undefined }
          : r,
      ),
    );
  }, []);

  const cancelEntry = useCallback(
    (index: number) => {
      const ctrl = entryControllersRef.current.get(index);
      if (ctrl) {
        try {
          ctrl.abort();
        } catch {}
        entryControllersRef.current.delete(index);
      }
      updateResult(index, {
        status: "error",
        compiled: false,
        errorMessage: "Cancelled by user",
        liveStatus: undefined,
        startedAt: undefined,
      });
      pushLiveEvent(index, "Cancelled by user.");
    },
    [pushLiveEvent, updateResult],
  );

  const clearAndReset = useCallback(async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(msKey(activeMilestone));
        localStorage.removeItem(TEST_SUITE_STORAGE_KEY);
      } catch {}
    }

    try {
      const res = await fetch(`/api/test-suite/milestones?id=${activeMilestone}`);
      const data = await res.json();
      if (data.milestone?.ideas?.length) {
        const freshIdeas = data.milestone.ideas as AppIdea[];
        setIdeas(freshIdeas);
        setResults(makeInitialResults(freshIdeas));
      } else {
        setResults(makeInitialResults(ideas));
      }
    } catch {
      setResults(makeInitialResults(ideas));
    }

    setRunning(false);
    setCurrentRunId(null);
    setCompletedCount(0);
  }, [ideas, activeMilestone, msKey]);

  const [exportedCount, setExportedCount] = useState<number | null>(null);

  const exportToDashboard = useCallback(() => {
    const succeeded = results.filter((r) => r.status === "succeeded" && r.projectId);
    if (succeeded.length === 0) return;

    const STORAGE_KEY = "vibetree-projects";
    let existing: Array<{ id: string; name: string; bundleId: string; createdAt?: number; updatedAt: number }> = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) existing = JSON.parse(raw);
    } catch {}

    const existingIds = new Set(existing.map((p) => p.id));
    let added = 0;
    const now = Date.now();

    for (const r of succeeded) {
      if (!r.projectId || existingIds.has(r.projectId)) continue;
      existing.unshift({
        id: r.projectId,
        name: r.idea.title,
        bundleId: `com.vibetree.${r.projectId.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase()}`.slice(0, 60),
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    setExportedCount(added);
    setTimeout(() => setExportedCount(null), 3000);
  }, [results]);

  const rerunSingle = useCallback(
    async (index: number) => {
      setRunning(true);
      await runSingleTest(index, { model, projectType: "pro" }, () => false);
      setRunning(false);
    },
    [model, runSingleTest],
  );

  const pendingIndices = results
    .map((r, i) => i)
    .filter((i) => results[i].status === "pending" && !results[i].excluded && results[i].selected !== false);
  const canResume = !running && pendingIndices.length > 0;

  const activeIndex = results.findIndex(
    (r) => !r.excluded && (r.status === "generating" || r.status === "building" || r.status === "auto-fixing"),
  );
  const jumpToActive = useCallback(() => {
    if (activeIndex < 0) return;
    const el = document.querySelector(`[data-test-index="${activeIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const retryableIndices = results
    .map((r, i) => i)
    .filter((i) => {
      const r = results[i];
      if (r.excluded) return false;
      return r.status === "pending" || r.status === "error";
    });
  const canRetry = !running && retryableIndices.length > 0;

  const resumeRun = useCallback(async () => {
    const pending = results
      .map((_, i) => i)
      .filter((i) => results[i].status === "pending" && !results[i].excluded && results[i].selected !== false);
    if (pending.length === 0) return;
    abortRef.current = false;
    setRunning(true);
    setRunStartTime(Date.now());
    setRunElapsed(0);
    const config: RunConfig = { model, projectType: "pro" };
    const initialDone = results.filter((r) => r.status !== "pending").length;
    let doneInResume = 0;
    const lanes = concurrencyRef.current;

    try {
      let cursor = 0;
      async function worker() {
        while (cursor < pending.length) {
          if (abortRef.current || pauseAfterNextRef.current) break;
          const idx = pending[cursor++];
          if (idx === undefined) break;
          await runSingleTest(idx, config, () => abortRef.current);
          doneInResume++;
          setCompletedCount(initialDone + doneInResume);
          if (pauseAfterNextRef.current) break;
          if (cursor < pending.length && !abortRef.current) {
            await sleep(lanes > 1 ? 500 : 1000);
          }
        }
      }
      const workers = Array.from({ length: lanes }, () => worker());
      await Promise.all(workers);

      if (pauseAfterNextRef.current) {
        pauseAfterNextRef.current = false;
        setPauseAfterNext(false);
      }
    } finally {
      setRunning(false);
      setRunStartTime(null);
      setPauseAfterNext(false);
      pauseAfterNextRef.current = false;
      loadPastRuns();
    }
  }, [model, results, runSingleTest, loadPastRuns]);

  const retryIncomplete = useCallback(async () => {
    const indices = results
      .map((_, i) => i)
      .filter((i) => {
        const r = results[i];
        if (r.excluded) return false;
        return r.status === "pending" || r.status === "error";
      });
    if (indices.length === 0) return;
    abortRef.current = false;
    setRunning(true);
    setRunStartTime(Date.now());
    setRunElapsed(0);
    const config: RunConfig = { model, projectType: "pro" };
    let done = 0;
    const lanes = concurrencyRef.current;

    for (const i of indices) {
      setResults((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: "pending", compilerErrors: [], attempts: 0, durationMs: 0, errorMessage: undefined, buildResultId: undefined, projectFiles: undefined };
        return next;
      });
    }

    try {
      let cursor = 0;
      async function worker() {
        while (cursor < indices.length) {
          if (abortRef.current || pauseAfterNextRef.current) break;
          const idx = indices[cursor++];
          if (idx === undefined) break;
          await runSingleTest(idx, config, () => abortRef.current);
          done++;
          if (pauseAfterNextRef.current) break;
          if (cursor < indices.length && !abortRef.current) {
            await sleep(lanes > 1 ? 500 : 1000);
          }
        }
      }
      const workers = Array.from({ length: lanes }, () => worker());
      await Promise.all(workers);

      if (pauseAfterNextRef.current) {
        pauseAfterNextRef.current = false;
        setPauseAfterNext(false);
      }
    } finally {
      setRunning(false);
      setRunStartTime(null);
      setPauseAfterNext(false);
      pauseAfterNextRef.current = false;
      loadPastRuns();
    }
  }, [model, results, runSingleTest, loadPastRuns]);

  const toggleExclude = useCallback((index: number) => {
    setResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], excluded: !next[index].excluded };
      return next;
    });
  }, []);

  const toggleSelect = useCallback((index: number) => {
    setResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: next[index].selected === false };
      return next;
    });
  }, []);

  const loadRun = useCallback((runId: string) => {
    const run = pastRuns.find((r) => r.id === runId);
    if (!run || !Array.isArray(run.results) || run.results.length === 0) return;

    setCurrentRunId(run.id);
    setRunning(false);

    setResults((prev) =>
      prev.map((row) => {
        const match = run.results.find((r) => r.title === row.idea.title);
        if (!match) return { ...row, status: "pending" as const, compiled: undefined, attempts: 0, compilerErrors: [], durationMs: 0, errorMessage: undefined, buildResultId: undefined };
        const compiled = Boolean(match.compiled);
        const errors = Array.isArray(match.errors) ? match.errors : [];
        return {
          ...row,
          status: compiled ? ("succeeded" as const) : ("failed" as const),
          compiled,
          attempts: typeof match.attempts === "number" ? match.attempts : row.attempts,
          durationMs: typeof match.durationMs === "number" ? match.durationMs : row.durationMs,
          fileCount: typeof (match as unknown as { fileCount?: number }).fileCount === "number" ? (match as unknown as { fileCount: number }).fileCount : row.fileCount,
          compilerErrors: errors,
          projectId: typeof match.projectId === "string" ? match.projectId : row.projectId,
          buildResultId: typeof match.buildResultId === "string" ? match.buildResultId : row.buildResultId,
          errorMessage: compiled ? undefined : row.errorMessage,
        };
      }),
    );
  }, [pastRuns]);

  const avgDuration = results.filter((r) => r.durationMs > 0).length > 0
    ? results.filter((r) => r.durationMs > 0).reduce((s, r) => s + r.durationMs, 0) /
      results.filter((r) => r.durationMs > 0).length
    : 0;
  const remaining = running
    ? pendingIndices.length * avgDuration
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

        {milestoneTabs.length > 0 && (
          <nav className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto pb-0">
              {milestoneTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchMilestone(tab.id)}
                  disabled={running || milestoneLoading}
                  title={tab.description}
                  className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeMilestone === tab.id
                      ? "border-[var(--button-primary-bg)] text-[var(--button-primary-bg)]"
                      : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
                </button>
              ))}
            </div>
          </nav>
        )}
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
            <div className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--background-tertiary)] p-0.5" role="group" aria-label="Concurrency">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setConcurrencyAndSave(n)}
                  disabled={running}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    concurrency === n
                      ? "bg-[var(--button-primary-bg)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {n}x
                </button>
              ))}
            </div>
            {!running ? (
              <>
                <Button onClick={runAllTests} className="gap-2" disabled={pendingIndices.length === 0} title={pendingIndices.length === 0 ? "No pending apps to run" : "Run only pending, non-excluded apps"}>
                  <Play className="h-4 w-4" aria-hidden />
                  Run pending ({pendingIndices.length})
                </Button>
                {canResume && (
                  <Button variant="secondary" onClick={resumeRun} className="gap-2" title="Run only the apps still pending (skips excluded)">
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Resume ({pendingIndices.length} left)
                  </Button>
                )}
                {canRetry && retryableIndices.length !== pendingIndices.length && (
                  <Button variant="secondary" onClick={retryIncomplete} className="gap-2" title="Retry all pending + errored/timed-out apps">
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Retry incomplete ({retryableIndices.length})
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={jumpToActive}
                  disabled={activeIndex < 0}
                  className="gap-2"
                  title={activeIndex < 0 ? "No active entry right now" : "Scroll to the entry currently being worked on"}
                >
                  <LocateFixed className="h-4 w-4" aria-hidden />
                  Jump to active
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/app-ideas/random?count=${DEFAULT_IDEAS.length}`);
                      const data = await res.json();
                      const nextIdeas = Array.isArray(data.ideas) ? (data.ideas as AppIdea[]) : [];
                      if (nextIdeas.length !== DEFAULT_IDEAS.length) return;
                      setIdeas((prev) => {
                        const seen = new Set(prev.map((i) => `${i.title}::${i.prompt}`));
                        const toAdd = nextIdeas.filter((i) => !seen.has(`${i.title}::${i.prompt}`));
                        return [...prev, ...toAdd];
                      });
                      setResults((prev) => {
                        const seen = new Set(prev.map((r) => `${r.idea.title}::${r.idea.prompt}`));
                        const toAdd = nextIdeas
                          .filter((i) => !seen.has(`${i.title}::${i.prompt}`))
                          .map((idea) => makeInitialResults([idea])[0]!);
                        return [...prev, ...toAdd];
                      });
                    } catch {
                      // ignore
                    }
                  }}
                  className="gap-2"
                  title="Add 10 more prompts to the list (keeps existing results)"
                >
                  <Shuffle className="h-4 w-4" aria-hidden />
                  Add 10 ideas
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/skills/test-prompts");
                      const data = await res.json();
                      if (!Array.isArray(data.skills)) return;
                      const capIdeas: AppIdea[] = [];
                      for (const sk of data.skills as Array<{ skillId: string; skillName: string; ideas: Array<{ title: string; prompt: string; tier: "easy" | "medium" | "hard"; category: string }> }>) {
                        for (const idea of sk.ideas) {
                          capIdeas.push({
                            title: `[${sk.skillName}] ${idea.title}`,
                            prompt: idea.prompt,
                            tier: idea.tier,
                            category: idea.category,
                          });
                        }
                      }
                      if (capIdeas.length === 0) return;
                      setIdeas((prev) => {
                        const seen = new Set(prev.map((i) => `${i.title}::${i.prompt}`));
                        const toAdd = capIdeas.filter((i) => !seen.has(`${i.title}::${i.prompt}`));
                        return [...prev, ...toAdd];
                      });
                      setResults((prev) => {
                        const seen = new Set(prev.map((r) => `${r.idea.title}::${r.idea.prompt}`));
                        const toAdd = capIdeas
                          .filter((i) => !seen.has(`${i.title}::${i.prompt}`))
                          .map((idea) => makeInitialResults([idea])[0]!);
                        return [...prev, ...toAdd];
                      });
                    } catch {
                      // ignore
                    }
                  }}
                  className="gap-2"
                  title="Load test prompts for all active skills from capability seed data"
                >
                  <Zap className="h-4 w-4" aria-hidden />
                  Load skill tests
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={stopRun} className="gap-2">
                <Square className="h-4 w-4" aria-hidden />
                Stop
              </Button>
            )}

            {running && (
              <div className="flex flex-1 items-center gap-3 min-w-[200px]">
                <span className="shrink-0 min-w-[65px] text-sm font-mono tabular-nums text-[var(--text-primary)]">
                  {formatDuration(runElapsed)}
                </span>
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
                  <div
                    className="h-full rounded-full bg-[var(--button-primary-bg)] transition-all duration-500"
                    style={{ width: `${(completedCount / ideas.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-[var(--text-tertiary)] shrink-0">
                  {completedCount}/{ideas.length}
                  {remaining > 0 && ` \u2022 ${formatRemainingHuman(remaining)} (${formatETATime(remaining)})`}
                </span>
              </div>
            )}

            {!running && syncingActive && (
              <span className="text-xs text-[var(--semantic-warning)]">Syncing active builds…</span>
            )}

            {!running && !syncingActive && activeIndex >= 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--semantic-warning)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Active: {results[activeIndex]?.status} — {results[activeIndex]?.idea?.title}
              </span>
            )}

            {currentRunId && !running && (() => {
              if (syncingActive || activeIndex >= 0) return null;
              const total = ideas.length;
              const excludedCount = results.filter((r) => r.excluded).length;
              const evaluable = total - excludedCount;
              const done = results.filter((r) => !r.excluded && r.status !== "pending").length;
              if (done === evaluable && evaluable > 0) return <span className="text-xs text-[var(--semantic-success)]">Run complete</span>;
              if (done > 0 && done < evaluable) return <span className="text-xs text-[var(--semantic-warning)]">Stopped after {done} apps</span>;
              return null;
            })()}

            {(() => {
              const milestoneRuns = pastRuns
                .filter((r) => Array.isArray(r.results) && r.results.length > 0 && r.milestone === activeMilestone)
                .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
              if (!running && milestoneRuns.length > 0) {
                const modelLabel = (m: string) => m === "opus-4.6" ? "Opus" : "Sonnet";
                const runOptions: SelectOption[] = [
                  { value: "", label: `History (${milestoneRuns.length} run${milestoneRuns.length !== 1 ? "s" : ""})` },
                  ...milestoneRuns.map((r, idx) => ({
                    value: r.id,
                    label: `${formatTimestamp(r.timestamp)} — ${modelLabel(r.model)} ${r.summary.compiled}/${r.summary.total} (${r.summary.compileRate}%)${idx === 0 ? " (latest)" : ""}`,
                  })),
                ];
                return (
                  <div className="flex items-center gap-1.5">
                    <History className="h-4 w-4 text-[var(--text-tertiary)]" aria-hidden />
                    <DropdownSelect
                      options={runOptions}
                      value={currentRunId ?? ""}
                      onChange={(v) => { if (v) loadRun(v); }}
                      className="min-w-[260px]"
                      aria-label="Load a past run"
                    />
                  </div>
                );
              }
              return null;
            })()}

            {results.some((r) => r.status === "succeeded" && r.projectId) && (
              <Button
                variant="ghost"
                onClick={exportToDashboard}
                className="gap-2"
                title="Export succeeded projects to the Dashboard so they appear in your app list"
              >
                {exportedCount !== null ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-[var(--semantic-success)]" aria-hidden />
                    {exportedCount > 0 ? `Added ${exportedCount}` : "Already exported"}
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Export to Dashboard
                  </>
                )}
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={clearAndReset}
              className="gap-2 ml-auto"
              title="Clear all results and reset state (stored data will be removed so refresh won’t restore it)"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear & reset
            </Button>
          </div>
          {concurrency === 2 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Zap className="h-3.5 w-3.5 text-[var(--semantic-warning)]" aria-hidden />
              For full 2x speed, start a second Mac runner in another terminal:
              <code className="rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 font-mono text-[10px]">
                MAC_RUNNER_ID=runner2 node scripts/mac-runner.mjs
              </code>
            </p>
          )}
        </section>

        {/* ── Summary (Sticky) ── */}
        {results.some((r) => !r.excluded && (r.status === "succeeded" || r.status === "failed" || r.status === "error")) && (
          <section className="sm:sticky sm:top-4 z-20">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-primary)]/70 backdrop-blur-sm p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Summary</h2>
                <button
                  type="button"
                  onClick={() => {
                    const report = generateRunReport(results, {
                      milestone: milestoneTabs.find((t) => t.id === activeMilestone)?.label ?? activeMilestone,
                      model,
                      target: milestoneTarget,
                    });
                    navigator.clipboard.writeText(report);
                    setCopiedReport(true);
                    setTimeout(() => setCopiedReport(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                >
                  {copiedReport ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--semantic-success)]" aria-hidden />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy Report
                    </>
                  )}
                </button>
              </div>
              <SummaryPanel
                results={results}
                target={milestoneTarget}
                running={running}
                runStartTime={runStartTime}
                onStop={running ? stopRun : undefined}
                onPauseAfterNext={running ? () => { pauseAfterNextRef.current = !pauseAfterNextRef.current; setPauseAfterNext(pauseAfterNextRef.current); } : undefined}
                pauseAfterNext={pauseAfterNext}
                errorsExpanded={errorsExpanded}
                onToggleErrors={() => setErrorsExpanded((v) => !v)}
              />
            </div>
          </section>
        )}

        {/* ── Results Table ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Results</h2>
          <div className="space-y-2">
            {results.map((result, i) => (
              <ResultRow
                key={result.idea.title}
                result={result}
                index={i}
                running={running}
                onRerun={() => rerunSingle(i)}
                onExclude={() => toggleExclude(i)}
                onToggleSelect={() => toggleSelect(i)}
                onUpdate={(updates) => updateResult(i, updates)}
                onCancel={() => cancelEntry(i)}
              />
            ))}
          </div>
        </section>

        {/* ── Run Comparison ── */}
        <section>
          <RunComparison runs={pastRuns} />
        </section>
      </main>
    </div>
  );
}
