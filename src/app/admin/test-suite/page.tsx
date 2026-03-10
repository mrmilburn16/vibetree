"use client";

import * as Sentry from "@sentry/nextjs";
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
  ClipboardPaste,
  X,
  Upload,
} from "lucide-react";
import { Button, DropdownSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { stripOldImages, type VisionMessage } from "@/lib/visionTestUtils";
import { refreshSessionCookie } from "@/lib/sessionRefresh";

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
  /** For M6 Integration milestone: summary from the LLM response (used to check portal warnings). */
  generationSummary?: string;
  /** For M6 Integration milestone: per-check pass/fail. */
  integrationChecks?: {
    plistComments: boolean;
    summaryWarnings: boolean;
    requestAuth: boolean;
    errorHandling: boolean;
  };
  /** Pasted Xcode runtime logs for this app (Paste Logs modal). */
  runtimeLogs?: string;
  /** Claude vision automated test report (Auto Test). */
  visionTestReport?: {
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
  };
};

type RunConfig = {
  model: string;
  projectType: "pro";
};

function parsePrompts(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

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
    integrationChecks?: { plistComments: boolean; summaryWarnings: boolean; requestAuth: boolean; errorHandling: boolean };
    runtimeLogs?: string;
    visionTestReport?: TestResult["visionTestReport"];
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
  | "member_not_found"
  | "missing_entitlement"
  | "missing_permission_string"
  | "framework_not_linked"
  | "deprecated_api"
  | "type_mismatch"
  | "missing_import"
  | "trailing_closure"
  | "scope_error"
  | "async_await_misuse"
  | "optional_unwrap_failure"
  | "bundle_id_mismatch"
  | "missing_capability"
  | "view_type_check_timeout"
  | "foreground_style_color"
  | "other";

const ERROR_PATTERNS: Array<{ category: ErrorCategory; patterns: RegExp[] }> = [
  { category: "member_not_found", patterns: [/has no member/i, /value of type .+ has no member/i] },
  {
    category: "missing_entitlement",
    patterns: [
      /missing .* entitlement/i,
      /com\.apple\.developer\.\w+/i,
      /not in entitlements/i,
      /entitlement.*required/i,
    ],
  },
  {
    category: "missing_permission_string",
    patterns: [
      /NSLocationWhenInUseUsageDescription|NSLocationAlwaysAndWhenInUseUsageDescription/i,
      /NSHealthShareUsageDescription|NSHealthUpdateUsageDescription/i,
      /NSCameraUsageDescription|NSMicrophoneUsageDescription|NSPhotoLibraryUsageDescription/i,
      /usage description.*required|required.*usage description/i,
      /Info\.plist.*privacy|privacy.*Info\.plist/i,
      /NSAppleMusicUsageDescription/i,
    ],
  },
  {
    category: "framework_not_linked",
    patterns: [
      /undefined symbol.*HealthKit|undefined symbol.*MapKit|undefined symbol.*MusicKit/i,
      /linker command failed/i,
      /Undefined symbols for architecture/i,
      /framework.*not found.*HealthKit|framework.*not found.*MapKit|framework.*not found.*MusicKit/i,
    ],
  },
  {
    category: "deprecated_api",
    patterns: [
      /deprecated|was deprecated in|renamed to/i,
      /\bNavigationView\b/i,
      /\.foregroundColor\b/i,
      /\.navigationBarTitle\b/i,
    ],
  },
  {
    category: "view_type_check_timeout",
    patterns: [/unable to type-check this expression in reasonable time/i],
  },
  {
    category: "foreground_style_color",
    patterns: [
      /cannot convert.*(Color|HierarchicalShapeStyle)/i,
      /HierarchicalShapeStyle.*Color|Color.*HierarchicalShapeStyle/i,
      /\.(white|black|gray|red|blue|green)\s*\).*foregroundStyle|foregroundStyle\s*\([^)]*\.(white|black|gray|red|blue|green)\b/i,
    ],
  },
  {
    category: "type_mismatch",
    patterns: [/cannot convert value of type/i, /cannot assign value of type/i],
  },
  {
    category: "missing_import",
    patterns: [
      /cannot find type '\w+' in scope/i,
      /cannot find '\w+' in scope/i,
      /no such module '\w+'/i,
      /use of unresolved identifier/i,
    ],
  },
  { category: "trailing_closure", patterns: [/extra trailing closure/i, /contextual closure type/i] },
  {
    category: "scope_error",
    patterns: [
      /used (before|outside).*declaration/i,
      /not in scope(?!.*unresolved)/i,
      /variable used (before|outside)/i,
    ],
  },
  {
    category: "async_await_misuse",
    patterns: [
      /missing 'await'/i,
      /call is 'async' but/i,
      /does not support concurrency/i,
      /async function.*called in.*non-async/i,
    ],
  },
  {
    category: "optional_unwrap_failure",
    patterns: [/unexpectedly found nil/i, /Fatal error:.*nil/i, /force.*unwrap.*nil/i],
  },
  {
    category: "bundle_id_mismatch",
    patterns: [
      /bundle (identifier|ID).*mismatch|provisioning profile.*bundle/i,
      /does not include.*bundle/i,
      /No profile for team.*matching/i,
    ],
  },
  {
    category: "missing_capability",
    patterns: [
      /capability.*not enabled|not enabled.*capability/i,
      /developer portal.*capability|App ID.*capability/i,
      /enable.*in (Apple Developer|developer portal)/i,
    ],
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

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  member_not_found: "Member not found",
  missing_entitlement: "Missing entitlement",
  missing_permission_string: "Missing permission string",
  framework_not_linked: "Framework not linked",
  deprecated_api: "Deprecated API",
  type_mismatch: "Type mismatch",
  missing_import: "Missing import",
  trailing_closure: "Trailing closure",
  scope_error: "Scope error",
  async_await_misuse: "Async/await misuse",
  optional_unwrap_failure: "Optional unwrap failure",
  bundle_id_mismatch: "Bundle ID mismatch",
  missing_capability: "Missing capability",
  view_type_check_timeout: "View body type-check timeout",
  foreground_style_color: "ForegroundStyle Color / HierarchicalShapeStyle",
  other: "Any other error",
};

type GroupedError = {
  category: ErrorCategory;
  displayName: string;
  appCount: number;
  occurrenceCount: number;
  items: Array<{ appName: string; rawMessage: string }>;
};

function groupErrorsByPattern(results: TestResult[]): GroupedError[] {
  const byCategory: Record<
    ErrorCategory,
    Array<{ appName: string; rawMessage: string }>
  > = {} as Record<ErrorCategory, Array<{ appName: string; rawMessage: string }>>;
  const categories: ErrorCategory[] = [
    "member_not_found",
    "missing_entitlement",
    "missing_permission_string",
    "framework_not_linked",
    "deprecated_api",
    "type_mismatch",
    "missing_import",
    "trailing_closure",
    "scope_error",
    "async_await_misuse",
    "optional_unwrap_failure",
    "bundle_id_mismatch",
    "missing_capability",
    "other",
  ];
  for (const cat of categories) byCategory[cat] = [];

  for (const r of results) {
    const appName = r.idea?.title ?? "Unknown app";
    for (const rawMessage of r.compilerErrors) {
      const cat = classifyError(rawMessage);
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({ appName, rawMessage });
    }
  }

  return categories
    .filter((cat) => byCategory[cat].length > 0)
    .map((cat) => {
      const items = byCategory[cat];
      const appCount = new Set(items.map((i) => i.appName)).size;
      return {
        category: cat,
        displayName: CATEGORY_LABELS[cat],
        appCount,
        occurrenceCount: items.length,
        items,
      };
    })
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
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

/** API → required plist key(s) for // REQUIRES PLIST: check */
const PRIVACY_API_TO_PLIST: Array<{ pattern: RegExp; keys: string[] }> = [
  { pattern: /\bCLLocationManager\b/, keys: ["NSLocationWhenInUseUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription"] },
  { pattern: /\bHKHealthStore\b/, keys: ["NSHealthShareUsageDescription", "NSHealthUpdateUsageDescription"] },
  { pattern: /\bAVCaptureDevice\b|\.video\b/, keys: ["NSCameraUsageDescription"] },
  { pattern: /\bAVAudioSession\b|\.microphone\b/, keys: ["NSMicrophoneUsageDescription"] },
  { pattern: /\bPHPhotoLibrary\b|\bPHPickerViewController\b/, keys: ["NSPhotoLibraryUsageDescription"] },
  { pattern: /\bCNContactStore\b/, keys: ["NSContactsUsageDescription"] },
  { pattern: /\bEKEventStore\b/, keys: ["NSCalendarsUsageDescription"] },
  { pattern: /\bCBCentralManager\b|\bCBPeripheralManager\b/, keys: ["NSBluetoothAlwaysUsageDescription"] },
  { pattern: /\bCMMotionManager\b/, keys: ["NSMotionUsageDescription"] },
  { pattern: /\bNFCTagReaderSession\b/, keys: ["NFCReaderUsageDescription"] },
  { pattern: /\bSFSpeechRecognizer\b/, keys: ["NSSpeechRecognitionUsageDescription"] },
  { pattern: /\bMusicAuthorization\b|\bApplicationMusicPlayer\b/, keys: ["NSAppleMusicUsageDescription"] },
];

function evaluateIntegrationChecks(
  files: Array<{ path: string; content: string }>,
  summary: string | undefined,
): { plistComments: boolean; summaryWarnings: boolean; requestAuth: boolean; errorHandling: boolean } {
  const combined = files.filter((f) => f.path.endsWith(".swift")).map((f) => f.content).join("\n");
  const combinedLower = combined.toLowerCase();
  const summaryLower = (summary ?? "").toLowerCase();

  let plistComments = true;
  for (const { pattern, keys } of PRIVACY_API_TO_PLIST) {
    if (!pattern.test(combined)) continue;
    const hasComment = keys.some((key) =>
      new RegExp(`//\\s*REQUIRES\\s+PLIST:\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(combined),
    );
    if (!hasComment) {
      plistComments = false;
      break;
    }
  }

  // UNUserNotificationCenter does not require portal capability — only runtime permission; do not require portal warning for it
  const needsPortalWarning = /\b(HKHealthStore|MusicAuthorization|MusicKit|ASAuthorizationAppleIDProvider|NSUbiquitousKeyValueStore|CKContainer|NFCTagReaderSession)\b/.test(combined);
  const summaryWarnings = !needsPortalWarning || (summaryLower.includes("enable") && (summaryLower.includes("developer portal") || summaryLower.includes("app id") || summaryLower.includes("capability") || summaryLower.includes("entitlement") || summaryLower.includes("portal")));

  const requestAuth =
    /\b(requestAuthorization|requestWhenInUseAuthorization|requestAccess\s*\(|requestPermission)\s*\(/.test(combined) ||
    /\bMusicAuthorization\.request\s*\(/.test(combined) ||
    /\bperformRequests\s*\(/.test(combined) ||
    /\bASAuthorizationAppleIDProvider\b/.test(combined) ||
    /\bDataScannerViewController\b/.test(combined) ||
    (/\bCKContainer\b/.test(combined) && /\baccountStatus\b/.test(combined)) ||
    (/\bNFCTagReaderSession\b/.test(combined) && /\breadingAvailable\b/.test(combined));

  const errorHandling =
    /\b(guard|if.*!.*available|isHealthDataAvailable|denied|unavailable|handle|catch|\.denied|\.restricted)\b/.test(combinedLower) ||
    /\b(permission.*denied|not available|graceful|fallback)\b/.test(combinedLower);

  return { plistComments, summaryWarnings, requestAuth, errorHandling };
}

const MILESTONE_LABELS: Record<string, string> = {
  "m1-baseline": "Baseline",
  "m2-easy": "Easy",
  "m3-medium": "Medium",
  "m4-hard": "Hard",
  "m5-wow": "Wow",
  "m6-integration": "Integration",
  "m7-regression": "Regression",
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
  const groupedByPattern = groupErrorsByPattern(completed);
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
  const isM6Report = opts.milestone?.toLowerCase().includes("integration");
  const integrationPassCount = isM6Report
    ? completed.filter(
        (r) =>
          r.compiled &&
          r.integrationChecks &&
          r.integrationChecks.plistComments &&
          r.integrationChecks.summaryWarnings &&
          r.integrationChecks.requestAuth &&
          r.integrationChecks.errorHandling,
      ).length
    : compiled;
  if (isM6Report) {
    lines.push(`- Integration pass: ${integrationPassCount}/${completed.length} (${completed.length ? Math.round((integrationPassCount / completed.length) * 100) : 0}%) \u2014 Target: ${opts.target ?? 70}%`);
  }
  lines.push(`- Avg attempts: ${(totalAttempts / completed.length).toFixed(1)}`);
  lines.push(`- Total time: ${formatDuration(totalDuration)}`);
  lines.push("");

  if (isM6Report && completed.some((r) => r.integrationChecks != null)) {
    lines.push("### Integration Checks Per App");
    lines.push("| App | Compile | PLIST Comments | Summary Warnings | Request Auth | Error Handling | Pass |");
    lines.push("|-----|---------|----------------|------------------|--------------|----------------|------|");
    for (const r of completed) {
      const c = r.integrationChecks;
      const compileCell = r.compiled ? "✓" : "✗";
      const plistCell = c ? (c.plistComments ? "✓" : "✗") : "—";
      const summaryCell = c ? (c.summaryWarnings ? "✓" : "✗") : "—";
      const requestCell = c ? (c.requestAuth ? "✓" : "✗") : "—";
      const errorCell = c ? (c.errorHandling ? "✓" : "✗") : "—";
      const pass =
        Boolean(r.compiled) &&
        Boolean(c?.plistComments && c?.summaryWarnings && c?.requestAuth && c?.errorHandling);
      const passCell = pass ? "✓" : "✗";
      const title = r.idea.title.replace(/\|/g, ", ");
      lines.push(`| ${title} | ${compileCell} | ${plistCell} | ${summaryCell} | ${requestCell} | ${errorCell} | ${passCell} |`);
    }
    lines.push("");
  }

  if (groupedByPattern.length > 0) {
    lines.push("### Error Patterns");
    for (const { displayName, appCount, occurrenceCount } of groupedByPattern) {
      lines.push(
        `- ${displayName}: ${occurrenceCount}x (${appCount} app${appCount !== 1 ? "s" : ""}) (${Math.round((occurrenceCount / allErrors.length) * 100)}%)`,
      );
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
        lines.push(`  Ratings: Design ${r.designRating ?? "\u2014"}/5, Works as expected: ${r.functionalityRating ?? "\u2014"}/5`);
      if (r.notes) lines.push(`  Notes: ${r.notes}`);
      lines.push("");
    }
  }

  if (autoFixed.length > 0) {
    lines.push("### Auto-fixed (succeeded after retries)");
    for (const r of autoFixed) {
      const extras: string[] = [];
      if (r.designRating || r.functionalityRating) extras.push(`D:${r.designRating ?? "-"}/5 W:${r.functionalityRating ?? "-"}/5`);
      if (r.notes) extras.push(`"${r.notes}"`);
      lines.push(`- ${r.idea.title}: ${r.attempts} attempts${extras.length ? ` — ${extras.join(", ")}` : ""}`);
    }
    lines.push("");
  }

  if (cleanPasses.length > 0) {
    lines.push("### Clean passes (1st attempt)");
    for (const r of cleanPasses) {
      const extras: string[] = [];
      if (r.designRating || r.functionalityRating) extras.push(`D:${r.designRating ?? "-"}/5 W:${r.functionalityRating ?? "-"}/5`);
      if (r.notes) extras.push(`"${r.notes}"`);
      lines.push(`- ${r.idea.title}${extras.length ? ` — ${extras.join(", ")}` : ""}`);
    }
    lines.push("");
  }

  if (isM6Report && completed.some((r) => r.integrationChecks != null)) {
    const integrationFailures = completed.filter((r) => {
      const c = r.integrationChecks;
      const pass =
        Boolean(r.compiled) &&
        Boolean(c?.plistComments && c?.summaryWarnings && c?.requestAuth && c?.errorHandling);
      return !pass;
    });
    if (integrationFailures.length > 0) {
      lines.push("### Integration Failures");
      for (const r of integrationFailures) {
        const failedChecks: string[] = [];
        if (!r.compiled) failedChecks.push("Compile");
        if (r.integrationChecks) {
          if (!r.integrationChecks.plistComments) failedChecks.push("PLIST comments");
          if (!r.integrationChecks.summaryWarnings) failedChecks.push("Summary warnings");
          if (!r.integrationChecks.requestAuth) failedChecks.push("Request auth");
          if (!r.integrationChecks.errorHandling) failedChecks.push("Error handling");
        }
        lines.push(`**${r.idea.title}** — Failed: ${failedChecks.join(", ")}`);
      }
      lines.push("");
    }
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
    lines.push(`Ratings: Design ${result.designRating ?? "\u2014"}/5, Works as expected: ${result.functionalityRating ?? "\u2014"}/5`);
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
    credentials: "include",
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

function PasteLogsModal({
  appName,
  initialLogs,
  onClose,
  onAnalyzeFix,
}: {
  appName: string;
  initialLogs: string;
  onClose: () => void;
  onAnalyzeFix: (content: string) => void;
}) {
  const [draft, setDraft] = useState(initialLogs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="paste-logs-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-primary)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
          <h2 id="paste-logs-title" className="text-sm font-semibold text-[var(--text-primary)]">
            Xcode Runtime Logs — {appName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden px-4 py-3">
          <p className="mb-2 text-xs text-[var(--text-secondary)]">
            Run the app on your iPhone via Xcode, reproduce the issue, then copy all output from the Xcode debug console (Cmd+A in the console area, then Cmd+C) and paste it here.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your Xcode console output here..."
            className="min-h-[200px] flex-1 resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-default)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-default)]"
            rows={12}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onAnalyzeFix(draft);
            }}
            className="gap-1.5"
          >
            Analyze & Fix
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportPromptsModal({
  tabLabel,
  pasteText,
  onPasteChange,
  mode,
  onModeChange,
  promptCount,
  showReplaceConfirm,
  existingCount,
  onClose,
  onImport,
  onConfirmReplace,
  onCancelReplaceConfirm,
}: {
  tabLabel: string;
  pasteText: string;
  onPasteChange: (value: string) => void;
  mode: "add" | "replace";
  onModeChange: (value: "add" | "replace") => void;
  promptCount: number;
  showReplaceConfirm: boolean;
  existingCount: number;
  onClose: () => void;
  onImport: () => void;
  onConfirmReplace: () => void;
  onCancelReplaceConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="import-prompts-title">
      <div className="absolute inset-0 bg-black/60" onClick={showReplaceConfirm ? onCancelReplaceConfirm : onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-primary)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
          <h2 id="import-prompts-title" className="text-sm font-semibold text-[var(--text-primary)]">
            {showReplaceConfirm ? "Replace all prompts?" : `Import Prompts to ${tabLabel}`}
          </h2>
          <button
            type="button"
            onClick={showReplaceConfirm ? onCancelReplaceConfirm : onClose}
            className="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden px-4 py-3">
          {showReplaceConfirm ? (
            <p className="py-4 text-sm text-[var(--text-secondary)]">
              This will replace all {existingCount} existing prompts in {tabLabel}. Continue?
            </p>
          ) : (
            <>
              <textarea
                value={pasteText}
                onChange={(e) => onPasteChange(e.target.value)}
                placeholder={"Paste prompts here — one per line\n\nTip: Copy a column from Google Sheets and paste it here"}
                className="min-h-[400px] flex-1 resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--button-primary-bg)]"
                rows={16}
              />
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                {promptCount} prompt{promptCount !== 1 ? "s" : ""} detected
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="text-xs text-[var(--text-secondary)]">Mode:</span>
                <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)]/50 p-0.5">
                  <button
                    type="button"
                    onClick={() => onModeChange("add")}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${mode === "add" ? "bg-[#10B981] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                    aria-pressed={mode === "add"}
                  >
                    Add to existing
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange("replace")}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${mode === "replace" ? "bg-[#10B981] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                    aria-pressed={mode === "replace"}
                    title="Replace all prompts in this tab"
                  >
                    Replace all
                  </button>
                </div>
                {mode === "replace" && existingCount > 0 && (
                  <span className="text-xs text-[var(--semantic-warning)]">Destructive — replaces current list</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-4 py-3">
          {showReplaceConfirm ? (
            <>
              <Button variant="ghost" onClick={onCancelReplaceConfirm}>
                Cancel
              </Button>
              <Button
                onClick={onConfirmReplace}
                className="bg-[#10B981] hover:bg-[#34D399] text-white border-0"
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onImport}
                disabled={promptCount < 1}
                className="bg-[#10B981] hover:bg-[#34D399] text-white border-0 disabled:opacity-50 disabled:pointer-events-none"
              >
                Import
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  result,
  index,
  onRerun,
  onExclude,
  onToggleSelect,
  onUpdate,
  onCancel,
  onOpenPasteLogs,
  onRunVisionTest,
  onStopVisionTest,
  running,
  visionTestRunning,
  visionTestStep,
  visionTestCostUsd,
  maxFixes,
}: {
  result: TestResult;
  index: number;
  onRerun?: () => void;
  onExclude?: () => void;
  onToggleSelect?: () => void;
  onUpdate?: (updates: Partial<TestResult>) => void;
  onCancel?: () => void;
  onOpenPasteLogs?: () => void;
  onRunVisionTest?: () => void;
  onStopVisionTest?: () => void;
  running: boolean;
  visionTestRunning?: boolean;
  visionTestStep?: number;
  visionTestCostUsd?: number;
  maxFixes?: number;
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-[280px] flex-1 items-center gap-3">
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
          <div className="min-w-[260px] flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={result.idea.title}>
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

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 self-start">
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
                      const filesRes = await fetch(`/api/projects/${result.projectId}/files`, { credentials: "include" });
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
                        credentials: "include",
                      }).catch((err) => Sentry.captureException(err));
                    }
                    const res = await fetch(`/api/projects/${result.projectId}/build-install`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        files: files?.length ? files : undefined,
                        projectName: toPascalCase(result.idea.title),
                        bundleId: "com.vibetree.test",
                        developmentTeam: teamId || undefined,
                        autoFix: result.status !== "succeeded",
                        maxAttempts: typeof maxFixes === "number" ? maxFixes : 8,
                      }),
                      credentials: "include",
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
                    let files = result.projectFiles?.length ? result.projectFiles : undefined;
                    if (!files?.length) {
                      const filesRes = await fetch(`/api/projects/${result.projectId}/files`, { credentials: "include" });
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
                        credentials: "include",
                      }).catch((err) => Sentry.captureException(err));
                      await downloadXcodeZip(
                        result.projectId!,
                        result.idea.title,
                        files,
                        teamId,
                      );
                    } else {
                      const url = `/api/projects/${result.projectId}/export-xcode`;
                      const res = await fetch(url, { credentials: "include" });
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

          {(result.status === "succeeded" || result.status === "failed" || result.status === "error") && onOpenPasteLogs && (
            <button
              type="button"
              onClick={onOpenPasteLogs}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-2 py-1 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)]"
              title={result.runtimeLogs ? "Runtime logs attached — click to edit or re-paste" : "Paste Xcode console logs to analyze"}
            >
              <ClipboardPaste className="h-3 w-3" aria-hidden />
              Paste Logs
              {result.runtimeLogs && (
                <span className="ml-0.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--semantic-success)]" aria-label="Logs attached" />
              )}
            </button>
          )}

          {(result.status === "succeeded" || result.status === "failed" || result.status === "error") && onRunVisionTest && (
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                disabled={visionTestRunning || !result.projectId}
                onClick={onRunVisionTest}
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
                ) : result.visionTestReport ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(true); } }}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      result.visionTestReport.recommendation === "Stopped"
                        ? "bg-[var(--text-tertiary)]/20 text-[var(--text-secondary)]"
                        : result.visionTestReport.overallScore >= 85
                          ? "bg-[var(--semantic-success)]/20 text-[var(--semantic-success)]"
                          : result.visionTestReport.overallScore >= 60
                            ? "bg-amber-500/20 text-amber-600"
                            : result.visionTestReport.overallScore >= 30
                              ? "bg-orange-500/20 text-orange-600"
                              : "bg-[var(--semantic-error)]/20 text-[var(--semantic-error)]"
                    }`}
                    title={`${result.visionTestReport.recommendation} — click to expand`}
                  >
                    {result.visionTestReport.recommendation === "Stopped" ? "Stopped" : result.visionTestReport.overallScore}
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
            </div>
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
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">Works as expected</span>
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

          {result.visionTestReport && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-3 space-y-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Auto test: {result.visionTestReport.overallScore}/100 — {result.visionTestReport.recommendation}
              </p>
              {typeof result.visionTestReport.total_cost_usd === "number" && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  Claude API cost: ${result.visionTestReport.total_cost_usd.toFixed(4)}
                  {typeof result.visionTestReport.total_input_tokens === "number" && typeof result.visionTestReport.total_output_tokens === "number" && (
                    <> ({result.visionTestReport.total_input_tokens} input tokens, {result.visionTestReport.total_output_tokens} output tokens)</>
                  )}
                </p>
              )}
              {result.visionTestReport.allIssues.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Issues found</p>
                  <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
                    {result.visionTestReport.allIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.visionTestReport.featuresTestedSuccessfully.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Features tested</p>
                  <p className="text-xs text-[var(--text-secondary)]">{result.visionTestReport.featuresTestedSuccessfully.join(", ")}</p>
                </div>
              )}
              {result.visionTestReport.screenshots.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {result.visionTestReport.screenshots.slice(0, 8).map((b64, i) => (
                    <img key={i} src={`data:image/png;base64,${b64}`} alt="" className="h-20 w-auto shrink-0 rounded border border-[var(--border-default)]" />
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result.visionTestReport!.cursorPrompt);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-2 py-1 text-xs font-medium text-[var(--button-secondary-text)]"
              >
                Copy fix prompt
              </button>
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
  activeMilestone,
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
  activeMilestone?: string;
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

  const isM6 = activeMilestone === "m6-integration";
  const isM7 = activeMilestone === "m7-regression";
  const compiled = completed.filter((r) => r.compiled).length;
  const integrationPassCount = isM6
    ? completed.filter(
        (r) =>
          r.compiled &&
          r.integrationChecks &&
          r.integrationChecks.plistComments &&
          r.integrationChecks.summaryWarnings &&
          r.integrationChecks.requestAuth &&
          r.integrationChecks.errorHandling,
      ).length
    : compiled;
  const totalAttempts = completed.reduce((s, r) => s + r.attempts, 0);
  const totalDuration = completed.reduce((s, r) => s + r.durationMs, 0);
  const allErrors = completed.flatMap((r) => r.compilerErrors);
  const grouped = groupErrorsByPattern(completed);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<ErrorCategory>>(() => new Set());
  const [integrationChecksCollapsed, setIntegrationChecksCollapsed] = useState(true);
  const maxOccurrence = grouped.length > 0 ? Math.max(...grouped.map((g) => g.occurrenceCount)) : 0;

  const runLabel =
    runStartTime != null
      ? new Date(runStartTime).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
      : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const passCount = isM6 ? integrationPassCount : compiled;
  const passPct = completed.length > 0 ? Math.round((passCount / completed.length) * 100) : 0;
  const avgAttempts = completed.length > 0 ? (totalAttempts / completed.length).toFixed(1) : "—";

  const handleCopyAllErrors = useCallback(() => {
    const header = [
      "# Vibetree Test Suite - Error Report",
      `# Run: ${runLabel} | Compile: ${compiled}/${completed.length} | Pass: ${passPct}% | Avg Attempts: ${avgAttempts}`,
      "# Fix these errors by updating SYSTEM_PROMPT_SWIFT or INTEGRATIONS.md",
      "---",
      "",
    ].join("\n");
    const blocks: string[] = [];
    for (const g of grouped) {
      for (const { appName, rawMessage } of g.items) {
        blocks.push(`App: ${appName}\nType: ${g.displayName}\n${rawMessage}\n---`);
      }
    }
    const text = header + blocks.join("\n\n");
    void navigator.clipboard.writeText(text);
  }, [grouped, runLabel, compiled, completed.length, passPct, avgAttempts]);

  const togglePattern = (cat: ErrorCategory) => {
    setExpandedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

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
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{isM6 ? "Integration pass rate" : "Pass rate"}</p>
          {(() => {
            const rate = passPct;
            const t = target ?? 70;
            const rateColor = rate >= t + 5 ? "text-[var(--semantic-success)]" : rate >= t - 5 ? "text-yellow-400" : "text-[var(--semantic-error)]";
            return (
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${rateColor}`}>
                {passCount}/{completed.length} ({rate}%)
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

      {isM6 && completed.some((r) => r.integrationChecks != null) && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
          <button
            type="button"
            onClick={() => setIntegrationChecksCollapsed((prev) => !prev)}
            className="mb-2 flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-expanded={!integrationChecksCollapsed}
          >
            <span>Integration checks per app</span>
            {integrationChecksCollapsed ? (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </button>
          {!integrationChecksCollapsed && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-[var(--text-tertiary)]">
                  <th className="pb-2 pr-2 font-medium">App</th>
                  <th className="pb-2 pr-2 font-medium text-center">Compile</th>
                  <th className="pb-2 pr-2 font-medium text-center">PLIST comments</th>
                  <th className="pb-2 pr-2 font-medium text-center">Summary warnings</th>
                  <th className="pb-2 pr-2 font-medium text-center">Request auth</th>
                  <th className="pb-2 pr-2 font-medium text-center">Error handling</th>
                  <th className="pb-2 font-medium text-center">Pass</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                {completed.map((r) => {
                  const c = r.integrationChecks;
                  const pass =
                    Boolean(r.compiled) &&
                    Boolean(c?.plistComments && c?.summaryWarnings && c?.requestAuth && c?.errorHandling);
                  return (
                    <tr key={r.idea.title} className="border-b border-[var(--border-subtle)]">
                      <td className="py-1.5 pr-2 font-medium text-[var(--text-primary)]">{r.idea.title}</td>
                      <td className="py-1.5 pr-2 text-center">{r.compiled ? "✓" : "✗"}</td>
                      <td className="py-1.5 pr-2 text-center">{c ? (c.plistComments ? "✓" : "✗") : "—"}</td>
                      <td className="py-1.5 pr-2 text-center">
                        {c ? (c.summaryWarnings ? "✓" : (
                          <span className="inline-flex items-center justify-center gap-0.5" title={!(r.generationSummary?.trim()) ? "No summary captured — check failed due to missing summary" : undefined}>
                            ✗
                            {!(r.generationSummary?.trim()) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--semantic-warning)]" aria-hidden />}
                          </span>
                        )) : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-center">{c ? (c.requestAuth ? "✓" : "✗") : "—"}</td>
                      <td className="py-1.5 pr-2 text-center">{c ? (c.errorHandling ? "✓" : "✗") : "—"}</td>
                      <td className={`py-1.5 text-center font-semibold ${pass ? "text-[var(--semantic-success)]" : "text-[var(--text-tertiary)]"}`}>
                        {pass ? "✓" : "✗"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {(isM6 || isM7) && completed.some((r) => r.visionTestReport) && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Auto test (Claude vision)</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-[var(--text-secondary)]">
              {completed.filter((r) => r.visionTestReport).length}/{completed.length} apps tested
            </span>
            <span className="text-[var(--text-secondary)]">
              Avg score:{" "}
              {(() => {
                const withReport = completed.filter((r) => r.visionTestReport);
                if (withReport.length === 0) return "—";
                const sum = withReport.reduce((s, r) => s + (r.visionTestReport?.overallScore ?? 0), 0);
                return `${Math.round(sum / withReport.length)}/100`;
              })()}
            </span>
            <span className="text-[var(--text-secondary)]">
              Total issues: {completed.reduce((s, r) => s + (r.visionTestReport?.allIssues?.length ?? 0), 0)}
            </span>
            <button
              type="button"
              onClick={() => {
                const runLabel =
                  runStartTime != null
                    ? new Date(runStartTime).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
                    : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
                const milestoneLabel = isM6 ? "M6: Integration" : "M7: Regression";
                const appsWithIssues = completed.filter((r) => (r.visionTestReport?.allIssues?.length ?? 0) > 0);
                const lines = [
                  `The following UI and functionality issues were automatically detected by Claude vision testing across ${appsWithIssues.length} apps in the ${milestoneLabel} test suite run on ${runLabel}. For each issue:`,
                  "1. Update SYSTEM_PROMPT_SWIFT in claudeAdapter.ts to prevent this from occurring in future generated apps",
                  "2. Update INTEGRATIONS.md if the issue relates to an integration",
                  "3. Show before/after for each change",
                  "4. Explain which error pattern each fix addresses",
                  "",
                  "Issues found:",
                  ...appsWithIssues.flatMap((r) =>
                    (r.visionTestReport!.allIssues).map((issue) => `${r.idea.title} — ${issue}`)
                  ),
                ];
                navigator.clipboard.writeText(lines.join("\n"));
              }}
              className="rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--button-primary-text)] hover:opacity-90"
            >
              Fix all issues
            </button>
          </div>
        </div>
      )}

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
          <div className="flex w-full items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggleErrors}
              className="flex flex-1 items-center justify-between rounded-[var(--radius-md)] px-1 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
            >
              <span>Error patterns ({allErrors.length})</span>
              {errorsExpanded ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
            </button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyAllErrors}
              className="shrink-0 gap-1 px-2 py-1 min-h-0 text-xs"
              aria-label="Copy all errors for Cursor"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy all errors
            </Button>
          </div>
          {errorsExpanded && (
            <div className="mt-1.5 space-y-0.5">
              {grouped.map((g) => {
                const isExpanded = expandedPatterns.has(g.category);
                return (
                  <div key={g.category} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-tertiary)]/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => togglePattern(g.category)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--background-tertiary)]/50"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />}
                      <span className="w-6 text-right font-semibold tabular-nums text-[var(--text-primary)]">{g.appCount}</span>
                      <span className="text-[var(--text-tertiary)]">apps</span>
                      <span className="w-10 text-right font-semibold tabular-nums text-[var(--text-primary)]">{g.occurrenceCount}x</span>
                      <div className="h-1.5 min-w-[4rem] flex-1 max-w-24 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
                        <div
                          className="h-full rounded-full bg-[var(--semantic-error)] transition-all"
                          style={{ width: `${maxOccurrence > 0 ? Math.min(100, (g.occurrenceCount / maxOccurrence) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="shrink-0 font-medium text-[var(--text-secondary)]">{g.displayName}</span>
                    </button>
                    {isExpanded && (
                      <div className="max-h-48 overflow-y-auto border-t border-[var(--border-subtle)] px-2 py-1.5">
                        <ul className="space-y-1.5 font-mono text-[10px] text-[var(--text-secondary)]">
                          {g.items.map((item, i) => (
                            <li key={i} className="rounded bg-[var(--background-primary)]/80 px-2 py-1 break-words">
                              <span className="font-sans font-medium text-[var(--text-tertiary)]">App: {item.appName}</span>
                              <pre className="mt-0.5 whitespace-pre-wrap text-[var(--text-primary)]">{item.rawMessage}</pre>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
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
const MAX_FIXES_STORAGE_KEY = "vibetree-test-suite-max-fixes";
const ACTIVE_MILESTONE_STORAGE_KEY = "vibetree-test-suite-active-milestone";

const MAX_FIXES_OPTIONS: readonly (0 | 1 | 3 | 8)[] = [0, 1, 3, 8];

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
        generationSummary: typeof row.generationSummary === "string" ? (row.generationSummary as string) : undefined,
        integrationChecks:
          row.integrationChecks && typeof row.integrationChecks === "object"
            ? (row.integrationChecks as { plistComments: boolean; summaryWarnings: boolean; requestAuth: boolean; errorHandling: boolean })
            : undefined,
        runtimeLogs: typeof row.runtimeLogs === "string" ? row.runtimeLogs : undefined,
        visionTestReport: row.visionTestReport && typeof row.visionTestReport === "object" ? row.visionTestReport as TestResult["visionTestReport"] : undefined,
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
    const resultsWithoutFiles = state.results.map((r) => {
      const { projectFiles: _, ...rest } = r;
      return rest;
    });
    const stateToSave = { ...state, results: resultsWithoutFiles };
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));
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

  const [activeMilestone, setActiveMilestone] = useState(() => {
    if (typeof window === "undefined") return "m1-baseline";
    try {
      const s = localStorage.getItem(ACTIVE_MILESTONE_STORAGE_KEY);
      if (s && s.trim()) return s.trim();
    } catch {}
    return "m1-baseline";
  });
  const [milestoneTarget, setMilestoneTarget] = useState(70);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [milestoneTabs, setMilestoneTabs] = useState<Array<{ id: string; label: string; count: number; target: number; description: string }>>([]);
  const [copiedReport, setCopiedReport] = useState(false);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [runElapsed, setRunElapsed] = useState(0);
  const [pasteLogsModalIndex, setPasteLogsModalIndex] = useState<number | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPasteText, setImportPasteText] = useState("");
  const [importMode, setImportMode] = useState<"add" | "replace">("add");
  const [importShowReplaceConfirm, setImportShowReplaceConfirm] = useState(false);
  const [visionTestRunningIndex, setVisionTestRunningIndex] = useState<number | null>(null);
  const [visionTestStep, setVisionTestStep] = useState(0);
  const [visionTestCostUsd, setVisionTestCostUsd] = useState(0);
  const [visionTestTapMode, setVisionTestTapMode] = useState<"coordinates" | "elements">("elements");
  const [autoVisionEnabled, setAutoVisionEnabled] = useState(true);
  const autoVisionEnabledRef = useRef(true);
  const visionQueueRef = useRef<Array<{ idx: number; projectId: string }>>([]);
  const visionWorkerRunningRef = useRef(false);
  const processVisionQueueRef = useRef<() => Promise<void>>(async () => {});
  const visionTestAbortControllerRef = useRef<AbortController | null>(null);
  const visionTestStopRequestedRef = useRef(false);
  const [pasteLogsCopied, setPasteLogsCopied] = useState(false);
  const [runnerOnline, setRunnerOnline] = useState<boolean | null>(null);
  const [runPausedByRunner, setRunPausedByRunner] = useState(false);
  const [concurrency, setConcurrency] = useState<1 | 2>(() => {
    if (typeof window === "undefined") return 1;
    try { return localStorage.getItem(CONCURRENCY_STORAGE_KEY) === "2" ? 2 : 1; } catch { return 1; }
  });
  const concurrencyRef = useRef(concurrency);
  const [maxFixes, setMaxFixes] = useState<0 | 1 | 3 | 8>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const s = localStorage.getItem(MAX_FIXES_STORAGE_KEY);
      const n = parseInt(s ?? "", 10);
      if (MAX_FIXES_OPTIONS.includes(n as 0 | 1 | 3 | 8)) return n as 0 | 1 | 3 | 8;
    } catch {}
    return 1;
  });
  const maxFixesRef = useRef(maxFixes);
  maxFixesRef.current = maxFixes;
  useEffect(() => {
    autoVisionEnabledRef.current = autoVisionEnabled;
  }, [autoVisionEnabled]);

  function setConcurrencyAndSave(n: 1 | 2) {
    setConcurrency(n);
    concurrencyRef.current = n;
    try { localStorage.setItem(CONCURRENCY_STORAGE_KEY, String(n)); } catch {}
  }
  function setMaxFixesAndSave(n: 0 | 1 | 3 | 8) {
    setMaxFixes(n);
    maxFixesRef.current = n;
    try { localStorage.setItem(MAX_FIXES_STORAGE_KEY, String(n)); } catch {}
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
      .catch((err) => Sentry.captureException(err));
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
    try {
      localStorage.setItem(ACTIVE_MILESTONE_STORAGE_KEY, activeMilestone);
    } catch {}
  }, [activeMilestone]);

  useEffect(() => {
    if (importModalOpen) {
      setImportModalOpen(false);
      setImportShowReplaceConfirm(false);
      setImportPasteText("");
    }
  }, [activeMilestone]);

  useEffect(() => {
    const poll = () => {
      fetch("/api/runner/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.online === "boolean") {
            setRunnerOnline(data.online);
            if (data.online && runPausedByRunner) setRunPausedByRunner(false);
          }
        })
        .catch(() => setRunnerOnline(false));
    };
    poll();
    const id = setInterval(poll, 15 * 1000);
    return () => clearInterval(id);
  }, [runPausedByRunner]);

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
        .catch((err) => Sentry.captureException(err));
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

  useEffect(() => {
    if (!hydratedRef.current || !results.length) return;
    results.forEach((r, i) => {
      if (r.status !== "succeeded" || !r.projectId || (r.projectFiles?.length ?? 0) > 0) return;
      fetch(`/api/projects/${r.projectId}/files`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { files?: Array<{ path: string; content: string }> } | null) => {
          if (data?.files?.length) {
            setResults((prev) => {
              const next = [...prev];
              if (next[i]?.projectId === r.projectId && !(next[i].projectFiles?.length)) {
                next[i] = { ...next[i], projectFiles: data.files };
              }
              return next;
            });
          }
        })
        .catch((err) => Sentry.captureException(err));
    });
  }, [results]);

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
        const saved = loadPersistedState(msKey(newMilestone));
        const res = await fetch(`/api/test-suite/milestones?id=${newMilestone}`);
        const data = await res.json();
        const config = data.milestone;

        if (config?.ideas?.length) {
          setMilestoneTarget(config.target ?? 70);
        }

        if (saved && saved.results.length > 0) {
          setIdeas(saved.results.map((r) => r.idea));
          setResults(saved.results);
          setCurrentRunId(saved.currentRunId);
          setCompletedCount(saved.results.filter((r) => !r.excluded && r.status !== "pending").length);
          setModel(saved.model);
          setMilestoneTabs((prev) =>
            prev.map((t) => (t.id === newMilestone ? { ...t, count: saved.results.length } : t)),
          );
        } else if (config?.ideas?.length) {
          const newIdeas = config.ideas as AppIdea[];
          setIdeas(newIdeas);
          setResults(makeInitialResults(newIdeas));
          setCurrentRunId(null);
          setCompletedCount(0);
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
      const idea = results[index]?.idea ?? ideas[index] ?? DEFAULT_IDEAS[index];
      if (!idea?.prompt) {
        const err = "No prompt for this test — cannot run.";
        updateResult(index, { status: "error", errorMessage: err, compiled: false });
        return { idea: results[index]?.idea ?? ideas[index] ?? DEFAULT_IDEAS[0]!, status: "error", attempts: 0, compilerErrors: [], durationMs: 0, fileCount: 0, errorMessage: err };
      }
      const t0 = Date.now();

      try {
        if (getAbort()) throw new Error(ABORTED_MSG);
        const entryStart = Date.now();
        updateResult(index, { status: "generating", startedAt: entryStart, liveStatus: "Starting generation...", liveEvents: [] });
        pushLiveEvent(index, "Starting generation…");

        const genStart = Date.now();
        const projectRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `[Test] ${(idea.title || "Untitled").slice(0, 80)}` }),
          credentials: "include",
        });
        const projectData = await projectRes.json().catch(() => ({}));
        const projectId = (projectData.project?.id ?? projectData.id) as string | undefined;
        if (!projectId) {
          const errMsg = typeof projectData?.error === "string" ? projectData.error : "No project id from API";
          const statusHint = !projectRes.ok ? ` (${projectRes.status})` : "";
          throw new Error(`${errMsg}${statusHint}`);
        }
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
          credentials: "include",
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
        let generationSummary: string | undefined;
        const contentRaw = (done as { assistantMessage?: { content?: string } }).assistantMessage?.content;
        if (typeof contentRaw === "string") {
          const trimmed = contentRaw.trim();
          try {
            const parsed = JSON.parse(contentRaw) as { summary?: string; files?: unknown };
            if (parsed.summary != null && String(parsed.summary).trim()) {
              generationSummary = String(parsed.summary).trim();
            } else if (trimmed) {
              generationSummary = trimmed;
            }
          } catch {
            if (trimmed) generationSummary = trimmed;
          }
        }
        if (activeMilestone === "m6-integration") {
          if (generationSummary != null && generationSummary.length > 0) {
            const preview = generationSummary.slice(0, 200) + (generationSummary.length > 200 ? "..." : "");
            console.log(`M6 Summary captured for ${idea.title}: ${preview}`);
          } else {
            console.warn(`M6 Summary NOT captured for ${idea.title} (summary empty or parse failed)`);
          }
        }
        const filesFromDone = (done as { projectFiles?: Array<{ path: string; content: string }> }).projectFiles;
        if (Array.isArray(filesFromDone) && filesFromDone.length > 0) projectFiles = filesFromDone;
        if (!projectFiles?.length) {
          try {
            const filesRes = await fetch(`/api/projects/${projectId}/files`, { credentials: "include" });
            if (filesRes.ok) {
              const data = (await filesRes.json()) as { files?: Array<{ path: string; content: string }> };
              if (Array.isArray(data.files) && data.files.length > 0) projectFiles = data.files;
            }
          } catch {
            /* ignore */
          }
        }
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
            autoFix: maxFixesRef.current > 0,
            maxAttempts: maxFixesRef.current,
            ...(developmentTeam ? { developmentTeam } : {}),
          }),
          credentials: "include",
        }).then((r) => r.json());

        if (buildRes?.error === "mac_runner_offline") {
          const msg = typeof buildRes.message === "string" ? buildRes.message : "Build server is offline. Builds are paused until the server comes back online.";
          updateResult(index, { status: "failed", errorMessage: msg, compiled: false });
          setRunPausedByRunner(true);
          abortRef.current = true;
          setRunning(false);
          const r = results[index];
          return { ...r, status: "failed", errorMessage: msg, compiled: false };
        }

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
            credentials: "include",
          }).catch((err) => Sentry.captureException(err));
        }

        const filesForChecks = (builtFiles?.length ? builtFiles : projectFiles) ?? [];
        const isM6 = activeMilestone === "m6-integration";
        const integrationChecks = isM6 && filesForChecks.length > 0 ? evaluateIntegrationChecks(filesForChecks, generationSummary) : undefined;

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
          projectId,
          liveStatus: undefined,
          startedAt: undefined,
          ...(builtFiles?.length ? { projectFiles: builtFiles } : {}),
          ...(generationSummary != null ? { generationSummary } : {}),
          ...(integrationChecks != null ? { integrationChecks } : {}),
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
          attempts: 0,
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
    [ideas, results, pushLiveEvent, updateResult, activeMilestone],
  );

  const runAllTests = useCallback(async () => {
    abortRef.current = false;
    await refreshSessionCookie();
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
              ...(r.integrationChecks ? { integrationChecks: r.integrationChecks } : {}),
              ...(r.runtimeLogs ? { runtimeLogs: r.runtimeLogs } : {}),
              ...(r.visionTestReport ? { visionTestReport: r.visionTestReport } : {}),
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
          if (result.compiled && result.projectId && autoVisionEnabledRef.current) {
            visionQueueRef.current.push({ idx, projectId: result.projectId });
            processVisionQueueRef.current?.();
          }
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

  const applyImport = useCallback(() => {
    const lines = parsePrompts(importPasteText);
    if (lines.length === 0) return;
    const newIdeas: AppIdea[] = lines.map((prompt, i) => {
      const title = prompt.length > 50 ? `${prompt.slice(0, 50)}…` : prompt || `Imported ${i + 1}`;
      return {
        title: prompt.trim() ? title : `Imported ${i + 1}`,
        prompt: prompt.trim(),
        category: "Imported",
        tier: "medium",
      };
    });
    if (importMode === "replace") {
      setIdeas(newIdeas);
      setResults(makeInitialResults(newIdeas));
      setMilestoneTabs((prev) =>
        prev.map((t) => (t.id === activeMilestone ? { ...t, count: newIdeas.length } : t))
      );
    } else {
      const seen = new Set(ideas.map((i) => `${i.title}::${i.prompt}`));
      const toAdd = newIdeas.filter((i) => !seen.has(`${i.title}::${i.prompt}`));
      const newCount = ideas.length + toAdd.length;
      setIdeas((prev) => {
        const s = new Set(prev.map((i) => `${i.title}::${i.prompt}`));
        const add = newIdeas.filter((i) => !s.has(`${i.title}::${i.prompt}`));
        return [...prev, ...add];
      });
      setResults((prev) => {
        const s = new Set(prev.map((r) => `${r.idea.title}::${r.idea.prompt}`));
        const add = newIdeas
          .filter((i) => !s.has(`${i.title}::${i.prompt}`))
          .map((idea) => makeInitialResults([idea])[0]!);
        return [...prev, ...add];
      });
      setMilestoneTabs((prev) =>
        prev.map((t) => (t.id === activeMilestone ? { ...t, count: newCount } : t))
      );
    }
    setImportModalOpen(false);
    setImportShowReplaceConfirm(false);
    setImportPasteText("");
  }, [importPasteText, importMode, activeMilestone, ideas.length, ideas]);

  const handleImportClick = useCallback(() => {
    const lines = parsePrompts(importPasteText);
    if (lines.length < 1) return;
    if (importMode === "replace" && ideas.length > 0) {
      setImportShowReplaceConfirm(true);
    } else {
      applyImport();
    }
  }, [importPasteText, importMode, ideas.length, applyImport]);

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
    setRunPausedByRunner(false);
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

  const runFirstAppOnly = useCallback(async () => {
    setRunning(true);
    setRunStartTime(Date.now());
    abortRef.current = false;
    try {
      await runSingleTest(0, { model, projectType: "pro" }, () => abortRef.current);
      setCompletedCount((prev) => prev + 1);
    } finally {
      setRunning(false);
      setRunStartTime(null);
      loadPastRuns();
    }
  }, [model, runSingleTest]);

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

  const loadRun = useCallback(
    (runId: string) => {
      setRunning(false);

      // "Select a past run..." (empty value) → restore current/latest state from localStorage
      if (!runId || runId.trim() === "") {
        setCurrentRunId(null);
        const key = msKey(activeMilestone);
        const saved = loadPersistedState(key);
        if (saved && saved.results.length > 0) {
          setIdeas(saved.results.map((r) => r.idea));
          setResults(saved.results);
          setCompletedCount(saved.completedCount);
          setMilestoneTabs((prev) =>
            prev.map((t) => (t.id === activeMilestone ? { ...t, count: saved.results.length } : t)),
          );
        }
        return;
      }

      const run = pastRuns.find((r) => r.id === runId);
      if (!run || !Array.isArray(run.results) || run.results.length === 0) return;

      setCurrentRunId(run.id);

      // Replace results and ideas with this run's data so the view shows the historical run
      const newResults: TestResult[] = run.results.map((r) => {
        const currentRow = results.find((row) => row.idea.title === r.title);
        const idea: AppIdea = currentRow?.idea ?? {
          title: r.title,
          category: r.category,
          prompt: r.title,
          tier: "medium",
        };
        const compiled = Boolean(r.compiled);
        const errors = Array.isArray(r.errors) ? r.errors : [];
        const matchWithExtras = r as typeof r & {
          integrationChecks?: { plistComments: boolean; summaryWarnings: boolean; requestAuth: boolean; errorHandling: boolean };
          runtimeLogs?: string;
          visionTestReport?: TestResult["visionTestReport"];
        };
        return {
          idea,
          status: (compiled ? "succeeded" : "failed") as TestResultStatus,
          compiled,
          attempts: typeof r.attempts === "number" ? r.attempts : 0,
          durationMs: typeof r.durationMs === "number" ? r.durationMs : 0,
          compilerErrors: errors,
          fileCount: typeof r.fileCount === "number" ? r.fileCount : 0,
          projectId: r.projectId,
          buildResultId: r.buildResultId,
          errorMessage: compiled ? undefined : "Build failed",
          selected: true,
          integrationChecks: matchWithExtras.integrationChecks,
          runtimeLogs: matchWithExtras.runtimeLogs,
          visionTestReport: matchWithExtras.visionTestReport,
        } as TestResult;
      });

      setIdeas(newResults.map((x) => x.idea));
      setResults(newResults);
      setCompletedCount(run.summary.total);
      setMilestoneTabs((prev) =>
        prev.map((t) => (t.id === activeMilestone ? { ...t, count: newResults.length } : t)),
      );
    },
    [pastRuns, results, activeMilestone, msKey],
  );

  const handlePasteLogsAnalyze = useCallback(
    (content: string) => {
      if (pasteLogsModalIndex == null) return;
      const r = results[pasteLogsModalIndex];
      if (!r) return;
      const milestoneLabel = milestoneTabs.find((t) => t.id === activeMilestone)?.label ?? activeMilestone;
      const designStr = r.designRating != null ? `${r.designRating}/5 stars` : "Not rated";
      const worksStr = r.functionalityRating != null ? `${r.functionalityRating}/5 stars` : "Not rated";
      const notesStr = (r.notes ?? "").trim() || "No notes";
      const logsStr = content.trim() || "No logs provided";
      const prompt = `---
App: ${r.idea.title}
Milestone: ${milestoneLabel}
Category: ${r.idea.category}

Manual Test Ratings:
- Design: ${designStr}
- Works as expected: ${worksStr}
- Notes: ${notesStr}

Xcode Logs:
${logsStr}

Please:
1. Identify root cause based on the ratings, notes, and logs above
2. Fix the issue in the system prompt (SYSTEM_PROMPT_SWIFT in claudeAdapter.ts)
3. Update INTEGRATIONS.md if this reveals a gap
4. Summarize what you changed and why
---`;
      navigator.clipboard.writeText(prompt);
      updateResult(pasteLogsModalIndex, { runtimeLogs: content });
      setPasteLogsModalIndex(null);
      setPasteLogsCopied(true);
      setTimeout(() => setPasteLogsCopied(false), 2500);
    },
    [pasteLogsModalIndex, results, activeMilestone, milestoneTabs, updateResult],
  );

  const runVisionTestRef = useRef<(index: number) => Promise<void>>(async () => {});
  const runVisionTest = useCallback(
    async (index: number) => {
      const result = results[index];
      if (!result?.projectId || !result.idea?.title) {
        console.warn("[vision-test] No projectId or title for index", index);
        return;
      }
      const projectId = result.projectId;
      const appName = result.idea.title;
      console.log("[vision-test] Starting for project", projectId);

      let appetizeRes: Response;
      try {
        appetizeRes = await fetch(`/api/projects/${projectId}/appetize`, { cache: "no-store", credentials: "include" });
      } catch (e) {
        console.error("[vision-test] Failed to fetch appetize key", e);
        return;
      }
      const appetizeData = await appetizeRes.json().catch(() => ({}));
      const publicKey = appetizeData?.publicKey;
      if (!publicKey) {
        console.warn("[vision-test] No Appetize public key for project", projectId, "- cannot run vision test");
        updateResult(index, {
          visionTestReport: {
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
        });
        return;
      }
      console.log("[vision-test] Appetize key found:", publicKey);

      setVisionTestRunningIndex(index);
      setVisionTestStep(0);
      setVisionTestCostUsd(0);

      const containerId = "vision-test-appetize-container";
      const iframeId = "vision-test-appetize-iframe";
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.cssText = "position:fixed;left:-9999px;top:0;width:378px;height:800px;z-index:1;";
        const iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.src = `https://appetize.io/embed/${publicKey}?grantPermissions=true`;
        iframe.width = "378";
        iframe.height = "800";
        iframe.setAttribute("frameborder", "0");
        container.appendChild(iframe);
        document.body.appendChild(container);
      } else {
        const iframe = container.querySelector("iframe");
        if (iframe) (iframe as HTMLIFrameElement).src = `https://appetize.io/embed/${publicKey}?grantPermissions=true`;
      }

      const SDK_TIMEOUT_MS = 10000;
      const loadScript = (): Promise<void> => {
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
      };

      const start = Date.now();
      const steps: Array<{ observation?: string; issues_found?: string[]; features_tested_so_far?: string[]; screenshot_base64?: string; logs_captured?: string[] }> = [];
      const messages: VisionMessage[] = [];
      let lastFeatures: string[] = [];
      let lastIssues: string[] = [];
      let allIssues: string[] = [];
      let featuresThatCouldNotBeTested: string[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const lastTapCoords: Array<{ x: number; y: number }> = [];
      const STUCK_SAME_COORD_THRESHOLD = 3;

      try {
        visionTestAbortControllerRef.current = new AbortController();
        visionTestStopRequestedRef.current = false;
        console.log("[vision-test] Loading Appetize SDK...");
        await loadScript();
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
        const client = await win.appetize?.getClient(`#${iframeId}`);
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
        await new Promise((r) => setTimeout(r, 3000));
        let appLoaded = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const shot = await session.screenshot("base64");
            const base64 = typeof shot?.data === "string" ? shot.data : "";
            if (base64) {
              const blank = await isScreenshotMostlyBlank(base64.replace(/^data:image\/\w+;base64,/, ""));
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
            break;
          }
          if (!screenshotBase64) break;

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
          const uiTreeString = uiTree !== undefined && uiTree !== null ? (typeof uiTree === "string" ? uiTree : JSON.stringify(uiTree)) : "";
          const truncatedUiTree = uiTreeString.slice(0, 3000);

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
          const rawBase64 = screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
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
              credentials: "include",
            });
          } catch (e) {
            const err = e as { name?: string; message?: string };
            if (err?.name === "AbortError" || err?.message?.includes("abort")) {
              stoppedByUser = true;
              console.log("[vision-test] Stop requested, exiting loop");
            }
          }
          if (stoppedByUser) break;
          if (!stepRes?.ok) {
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
            if (lastTapCoords.length > STUCK_SAME_COORD_THRESHOLD) lastTapCoords.shift();
            const lastThree = lastTapCoords.slice(-STUCK_SAME_COORD_THRESHOLD);
            const threeSame =
              lastThree.length >= STUCK_SAME_COORD_THRESHOLD &&
              lastThree.every((c) => c.x === lastThree[0].x && c.y === lastThree[0].y);
            if (threeSame) {
              console.log("[vision-test] Same coordinate tapped 3 times in a row, ending as done");
              break;
            }
          } else if (action === "tap" && (tapByText || tapByElementText || tapByElementLabel)) {
            lastTapCoords.length = 0;
          } else {
            lastTapCoords.length = 0;
          }

          lastFeatures = features;
          lastIssues = issues;
          allIssues = [...new Set([...allIssues, ...issues])];
          steps.push({
            observation: obs,
            issues_found: issues,
            features_tested_so_far: features,
            screenshot_base64: step === 0 || step === maxSteps - 1 || issues.length > 0 ? screenshotBase64 : undefined,
            logs_captured: logsSinceLastAction,
          });

          const runningLog = steps
            .map((s, i) => {
              const obsText = s.observation ?? "—";
              const issuePart = (s.issues_found?.length ?? 0) > 0 ? ` Issue: ${(s.issues_found ?? []).join("; ")}.` : "";
              return `Step ${i + 1}: ${obsText}.${issuePart}`;
            })
            .join("\n");
          updateResult(index, { notes: runningLog });

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

        let finalNotes = steps
          .map((s, i) => {
            const obsText = s.observation ?? "—";
            const issuePart = (s.issues_found?.length ?? 0) > 0 ? ` Issue: ${(s.issues_found ?? []).join("; ")}.` : "";
            return `Step ${i + 1}: ${obsText}.${issuePart}`;
          })
          .join("\n");
        if (steps.length > 0) {
          try {
            const sumRes = await fetch(`/api/projects/${projectId}/vision-test-summarize`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                steps: steps.map((s) => ({ observation: s.observation, issues_found: s.issues_found })),
              }),
              credentials: "include",
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
        const allLogs = steps.flatMap((s) => s.logs_captured ?? []);
        const consoleErrorsRe = /error|fatal|warning|failed|crash/i;
        const console_errors = [...new Set(allLogs.filter((line) => consoleErrorsRe.test(line)))];

        const cursorPrompt = allIssues.length > 0
          ? `Auto-test issues for **${appName}**:\n\n${allIssues.map((i) => `- ${i}`).join("\n")}\n\nFix these in SYSTEM_PROMPT_SWIFT and/or INTEGRATIONS.md.`
          : `No issues found for ${appName}.`;

        const total_cost_usd = totalInputTokens / 1_000_000 * 3 + totalOutputTokens / 1_000_000 * 15;

        const report = {
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
          console_errors,
          total_cost_usd,
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
        };

        console.log("[vision-test] Saving report...");
        await fetch(`/api/projects/${projectId}/vision-test-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
          credentials: "include",
        }).catch((err) => console.warn("[vision-test] Failed to POST report", err));

        updateResult(index, { visionTestReport: report, notes: finalNotes });
        console.log("[vision-test] Done. Score:", score);
      } catch (e) {
        console.error("[vision-test] Error", e);
      } finally {
        setVisionTestRunningIndex(null);
        setVisionTestStep(0);
        setVisionTestCostUsd(0);
        visionTestStopRequestedRef.current = false;
        const el = document.getElementById(containerId);
        if (el?.parentNode) el.parentNode.removeChild(el);
      }
    },
    [results, updateResult, visionTestTapMode],
  );
  runVisionTestRef.current = runVisionTest;

  const processVisionQueue = useCallback(async () => {
    if (visionWorkerRunningRef.current) return;
    const item = visionQueueRef.current.shift();
    if (!item) return;
    visionWorkerRunningRef.current = true;
    try {
      const pollIntervalMs = 3000;
      const pollMaxMs = 30000;
      const start = Date.now();
      let publicKey: string | null = null;
      while (Date.now() - start < pollMaxMs) {
        const res = await fetch(`/api/projects/${item.projectId}/appetize`, { cache: "no-store", credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (data?.publicKey) {
          publicKey = data.publicKey;
          break;
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
      if (publicKey) {
        await runVisionTestRef.current(item.idx);
      } else {
        console.warn("[vision-test] No Appetize key after 30s, skipping vision test for app at index", item.idx);
      }
    } finally {
      visionWorkerRunningRef.current = false;
      if (visionQueueRef.current.length > 0) {
        processVisionQueue();
      }
    }
  }, []);
  processVisionQueueRef.current = processVisionQueue;

  const handleStopVisionTest = useCallback(() => {
    console.log("[vision-test] Stop button clicked");
    visionTestStopRequestedRef.current = true;
    visionTestAbortControllerRef.current?.abort();
  }, []);

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
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6">
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
            <span
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)]"
              title={runnerOnline === true ? "Mac runner is connected" : runnerOnline === false ? "Mac runner is offline — builds unavailable" : "Checking runner status…"}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  runnerOnline === true ? "bg-emerald-500" : runnerOnline === false ? "bg-red-500" : "bg-[var(--text-tertiary)]"
                }`}
                aria-hidden
              />
              {runnerOnline === true ? "Runner online" : runnerOnline === false ? "Runner offline" : "Runner…"}
            </span>
          </div>
        </div>
        {runnerOnline === false && (
          <div
            className="w-full px-4 py-2 sm:px-6 border-t border-amber-500/30 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200"
            role="status"
          >
            Mac runner offline — builds are currently unavailable.
          </div>
        )}
        {runPausedByRunner && (
          <div
            className="w-full px-4 py-2 sm:px-6 border-t border-amber-500/30 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200"
            role="status"
          >
            Run paused — Mac runner went offline. Remaining apps will resume when you click Resume after the runner is back online.
          </div>
        )}

        {milestoneTabs.length > 0 && (
          <nav className="w-full px-4 sm:px-6">
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

      <main className="w-full px-4 py-8 sm:px-6 space-y-6">
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
            <div className="inline-flex items-center gap-1.5" title="Maximum autofix attempts per build">
              <span className="text-xs text-[var(--text-tertiary)] shrink-0">Max fixes:</span>
              <div className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--background-tertiary)] p-0.5" role="group" aria-label="Max autofix attempts">
                {MAX_FIXES_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxFixesAndSave(n)}
                    disabled={running}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      maxFixes === n
                        ? "bg-[#10B981] text-white"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-pressed={maxFixes === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {!running ? (
              <>
                <Button onClick={runAllTests} className="gap-2" disabled={pendingIndices.length === 0 || runnerOnline === false} title={runnerOnline === false ? "Build server is offline" : pendingIndices.length === 0 ? "No pending apps to run" : "Run only pending, non-excluded apps"}>
                  <Play className="h-4 w-4" aria-hidden />
                  Run pending ({pendingIndices.length})
                </Button>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={autoVisionEnabled}
                    onChange={(e) => setAutoVisionEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--button-primary-bg)] focus:ring-[var(--button-primary-bg)]/50"
                    aria-label="Auto Vision: run Claude vision test after each app compiles"
                  />
                  Auto Vision
                </label>
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
                {activeMilestone === "m6-integration" && (
                  <Button variant="secondary" onClick={runFirstAppOnly} className="gap-2" disabled={running} title="Run only the first app (Apple Music Playlist Creator) to verify M6 summary capture before running all 10">
                    <Play className="h-4 w-4" aria-hidden />
                    Run first app only
                  </Button>
                )}
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
                  onClick={() => {
                    setImportPasteText("");
                    setImportMode("add");
                    setImportShowReplaceConfirm(false);
                    setImportModalOpen(true);
                  }}
                  className="gap-2"
                  title="Bulk import prompts from a spreadsheet (paste one per line)"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  Import Prompts
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
                  { value: "", label: "Select a past run..." },
                  ...milestoneRuns.map((r, idx) => ({
                    value: r.id,
                    label: `${formatTimestamp(r.timestamp)} — ${modelLabel(r.model)} ${r.summary.compiled}/${r.summary.total} (${r.summary.compileRate}%)${idx === 0 ? " (latest)" : ""}`,
                  })),
                ];
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    <History className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" aria-hidden />
                    <DropdownSelect
                      options={runOptions}
                      value={currentRunId ?? ""}
                      onChange={(v) => loadRun(v ?? "")}
                      className="min-w-[260px]"
                      aria-label={`Load a past run (${milestoneRuns.length} run${milestoneRuns.length !== 1 ? "s" : ""} in history)`}
                    />
                    {currentRunId && (
                      <span className="text-xs text-[var(--text-tertiary)] italic" aria-live="polite">
                        Viewing past run
                      </span>
                    )}
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
                activeMilestone={activeMilestone}
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
                onOpenPasteLogs={() => setPasteLogsModalIndex(i)}
                onRunVisionTest={() => runVisionTest(i)}
                onStopVisionTest={visionTestRunningIndex === i ? handleStopVisionTest : undefined}
                visionTestRunning={visionTestRunningIndex === i}
                visionTestStep={visionTestRunningIndex === i ? visionTestStep : 0}
                visionTestCostUsd={visionTestRunningIndex === i ? visionTestCostUsd : undefined}
                maxFixes={maxFixes}
              />
            ))}
          </div>
        </section>

        {/* ── Run Comparison ── */}
        <section>
          <RunComparison runs={pastRuns} />
        </section>
      </main>

      {pasteLogsModalIndex != null && results[pasteLogsModalIndex] && (
        <PasteLogsModal
          appName={results[pasteLogsModalIndex].idea.title}
          initialLogs={results[pasteLogsModalIndex].runtimeLogs ?? ""}
          onClose={() => setPasteLogsModalIndex(null)}
          onAnalyzeFix={handlePasteLogsAnalyze}
        />
      )}

      {importModalOpen && (
        <ImportPromptsModal
          tabLabel={milestoneTabs.find((t) => t.id === activeMilestone)?.label ?? activeMilestone}
          pasteText={importPasteText}
          onPasteChange={setImportPasteText}
          mode={importMode}
          onModeChange={setImportMode}
          promptCount={parsePrompts(importPasteText).length}
          showReplaceConfirm={importShowReplaceConfirm}
          existingCount={ideas.length}
          onClose={() => {
            setImportModalOpen(false);
            setImportShowReplaceConfirm(false);
            setImportPasteText("");
          }}
          onImport={handleImportClick}
          onConfirmReplace={applyImport}
          onCancelReplaceConfirm={() => setImportShowReplaceConfirm(false)}
        />
      )}

      {pasteLogsCopied && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-lg"
          role="status"
          aria-live="polite"
        >
          Copied to clipboard — paste into Cursor to fix
        </div>
      )}
    </div>
  );
}
