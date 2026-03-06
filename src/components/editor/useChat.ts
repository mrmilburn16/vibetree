"use client";

import * as Sentry from "@sentry/nextjs";
import { useState, useCallback, useRef, useEffect } from "react";
import { featureFlags } from "@/lib/featureFlags";
import { updateProject } from "@/lib/projects";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  editedFiles?: string[];
  /** Token usage from API (real LLM only). Shown as cost after build. */
  usage?: { input_tokens: number; output_tokens: number };
  /** Estimated cost in USD for this message (real LLM only). */
  estimatedCostUsd?: number;
  /** How long the LLM took to generate this response (ms). */
  elapsedMs?: number;
  /** When this message was created (epoch ms). Used for "Built X ago" on restored messages. */
  createdAt?: number;
}

const PROJECT_FILES_STORAGE_PREFIX = "vibetree-project-files:";
const CHAT_MESSAGES_STORAGE_PREFIX = "vibetree-chat-messages:";

function saveProjectFilesToLocalStorage(
  projectId: string,
  files: Array<{ path: string; content: string }>
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`,
      JSON.stringify({ updatedAt: Date.now(), files })
    );
  } catch {
    // ignore quota errors
  }
}

function loadChatMessagesFromLocalStorage(projectId: string): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CHAT_MESSAGES_STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { messages?: unknown };
    if (!parsed || !Array.isArray(parsed.messages)) return null;

    const msgs: ChatMessage[] = parsed.messages
      .map((m) => m as Partial<ChatMessage>)
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          typeof m.id === "string"
      )
      .map((m) => ({
        id: m.id!,
        role: m.role as MessageRole,
        content: m.content ?? "",
        ...(Array.isArray(m.editedFiles) ? { editedFiles: m.editedFiles as string[] } : {}),
        ...(m.usage &&
        typeof (m.usage as any).input_tokens === "number" &&
        typeof (m.usage as any).output_tokens === "number"
          ? { usage: m.usage as { input_tokens: number; output_tokens: number } }
          : {}),
        ...(typeof m.estimatedCostUsd === "number" ? { estimatedCostUsd: m.estimatedCostUsd } : {}),
        ...(typeof m.elapsedMs === "number" ? { elapsedMs: m.elapsedMs } : {}),
        ...(typeof m.createdAt === "number" ? { createdAt: m.createdAt } : {}),
      }));

    // Drop stale in-flight progress and step messages on restore.
    return msgs.filter((m) => {
      if (m.id.startsWith("stream-progress-") || m.id.startsWith("stream-phase-") || m.id.startsWith("stream-file-")) return false;
      const c = (m.content ?? "").trim();
      const looksLikeLiveProgress =
        c.startsWith("Connecting…") ||
        c.startsWith("Planning next moves…") ||
        c.startsWith("Validating build on Mac…") ||
        c.startsWith("Finalizing…") ||
        c.startsWith("Thinking…");
      const hasMeta =
        (m.editedFiles?.length ?? 0) > 0 ||
        !!m.usage ||
        typeof m.estimatedCostUsd === "number";
      if (m.role === "assistant" && looksLikeLiveProgress && !hasMeta) return false;
      return true;
    });
  } catch {
    return null;
  }
}

function saveChatMessagesToLocalStorage(projectId: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    const stable = messages.filter((m) => !m.id.startsWith("stream-progress-"));
    const capped = stable.slice(-200);
    localStorage.setItem(
      `${CHAT_MESSAGES_STORAGE_PREFIX}${projectId}`,
      JSON.stringify({ updatedAt: Date.now(), messages: capped })
    );
  } catch {
    // ignore quota errors
  }
}

const MOCK_RESPONSES = [
  {
    content: "Created a fitness tracking app with activity rings.",
    editedFiles: ["Models/Workout.swift", "Models/Exercise.swift", "Views/ActivityRingsView.swift", "ContentView.swift"],
  },
  {
    content: "I've added a todo list with categories and due dates.",
    editedFiles: ["Models/TodoItem.swift", "Views/TodoListView.swift", "ContentView.swift"],
  },
  {
    content: "Built a simple habit tracker with daily check-ins.",
    editedFiles: ["Models/Habit.swift", "Views/HabitListView.swift", "ContentView.swift"],
  },
];

// Abort only when the stream is truly stalled.
// We do NOT time out while tokens are actively increasing.
const CONNECTING_TIMEOUT_MS = 180_000;
const NO_OUTPUT_TIMEOUT_MS = 240_000;
const TOKEN_STALL_TIMEOUT_MS = 6 * 60_000;
const USER_CANCEL_REASON = "Stopped by user";
const PROJECTS_STORAGE_KEY = "vibetree-projects";

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

export function deriveTitleFromPrompt(prompt: string): string | null {
  const p = (prompt ?? "").trim().replace(/\s+/g, " ");
  if (!p) return null;
  const m = p.match(/^(?:build|create|make|design)\s+(?:an?|the)\s+(.+?)(?:[.\n,]| with | that | which | where |$)/i);
  const raw = (m?.[1] ?? "").trim();
  const candidate = raw.replace(/\b(app|application)\b/gi, "").trim();
  if (candidate.length < 3) return null;
  return titleCase(candidate).slice(0, 42);
}

export function deriveTitleFromSummary(summary: string): string | null {
  const s = (summary ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  const m = s.match(/^(?:built|created|made)\s+(?:an?|the)\s+(.+?)(?:[.\n,]| with | that | which | where |$)/i);
  const raw = (m?.[1] ?? "").trim();
  const candidate = raw.replace(/\b(app|application)\b/gi, "").trim();
  if (candidate.length < 3) return null;
  return titleCase(candidate).slice(0, 42);
}

export function isUntitledName(name: string | undefined | null): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return !n || n === "untitled app" || n === "untitled";
}

function getStableMessagesForPersistence(messages: ChatMessage[]): ChatMessage[] {
  const out = messages.filter((m) => {
    if (m.id.startsWith("stream-phase-") || m.id.startsWith("stream-file-")) return true;
    if (m.id.startsWith("stream-progress-")) return false;
    const c = (m.content ?? "").trim();
    const looksLikeLiveProgress =
      c.startsWith("Connecting…") ||
      c.startsWith("Validating build on Mac…") ||
      c.startsWith("Thinking…");
    const hasMeta =
      (m.editedFiles?.length ?? 0) > 0 ||
      !!m.usage ||
      typeof m.estimatedCostUsd === "number";
    if (m.role === "assistant" && looksLikeLiveProgress && !hasMeta) return false;
    return true;
  });
  const streamPhase = out.filter((m) => m.id.startsWith("stream-phase-")).length;
  const streamFile = out.filter((m) => m.id.startsWith("stream-file-")).length;
  console.log("[getStableMessagesForPersistence] total in:", messages.length, "| total out:", out.length, "| stream-phase:", streamPhase, "| stream-file:", streamFile);
  return out;
}

function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m <= 0) return `${sec}s`;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m ${sec}s`;
}

function formatStatusDurations(status: string): string {
  return status.replace(/\((\d+)s\)/g, (_match, n) => {
    const seconds = Number.parseInt(String(n), 10);
    if (!Number.isFinite(seconds)) return _match;
    return `(${formatDurationShort(seconds)})`;
  });
}

function persistChatToServer(projectId: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  const stable = getStableMessagesForPersistence(messages);
  if (stable.length === 0) return;
  const url = `/api/projects/${projectId}/chat`;
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify({ messages: stable })], { type: "application/json" });
      // sendBeacon is best-effort and survives refresh/pagehide.
      (navigator as any).sendBeacon(url, blob);
      return;
    }
  } catch {
    // fall through to fetch
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: stable }),
    keepalive: true,
  }).catch((err) => Sentry.captureException(err));
}

function updateProjectNameInLocalStorage(projectId: string, name: string): void {
  if (typeof window === "undefined") return;
  try {
    updateProject(projectId, { name });
    return;
  } catch {
    // fall back to best-effort manual update below
  }
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(arr) ? [...arr] : [];
    const idx = next.findIndex((p: any) => p && p.id === projectId);
    if (idx >= 0) next[idx] = { ...next[idx], name, updatedAt: Date.now() };
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

interface QueuedMessage {
  text: string;
  model?: string;
  projectType: "standard" | "pro";
}

export function useChat(
  projectId: string,
  options?: {
    onError?: (message: string) => void;
    projectName?: string;
    /** Called when the project is auto-renamed from the first prompt. */
    onProjectRenamed?: (name: string) => void;
    /** Called when the message API returns 200 (real LLM path only). Use for deduct-on-success. */
    onMessageSuccess?: () => void;
    /** Called when the agent finishes and returns built app files (so we can show a toast). */
    onAppBuilt?: () => void;
    /** When a Pro (Swift) build completes, run validate on Mac and return result. Used to auto-validate and post result in chat. */
    onProBuildComplete?: (
      projectId: string,
      onProgress?: (status: string) => void
    ) => Promise<{
      status: "succeeded" | "failed";
      error?: string;
      message?: string;
      fixedFiles?: Array<{ path: string; content: string }>;
      attempts?: number;
      compilerErrors?: string[];
      errorHistory?: Array<{ attempt: number; errors: string[] }>;
      fileNames?: string[];
    }>;
  }
) {
  const { onError, projectName, onProjectRenamed, onMessageSuccess, onAppBuilt, onProBuildComplete } = options ?? {};
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatMessagesFromLocalStorage(projectId) ?? []);
  const [isTyping, setIsTyping] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "live" | "failed">("idle");
  const [input, setInput] = useState("");
  const [canSend, setCanSend] = useState(true);
  /** Progress message id and elapsed seconds for stream "Planning next moves…" — only this row re-renders on tick. */
  const [streamProgressMessageId, setStreamProgressMessageId] = useState<string | null>(null);
  const [streamElapsedSeconds, setStreamElapsedSeconds] = useState(-1);
  /** Progress message id, base text, and elapsed seconds for "Validating build on Mac…" — only this row re-renders on tick. */
  const [validateProgressMessageId, setValidateProgressMessageId] = useState<string | null>(null);
  const [validateProgressBase, setValidateProgressBase] = useState("");
  const [validateElapsedSeconds, setValidateElapsedSeconds] = useState(-1);

  const MAX_MESSAGE_LENGTH = 4000;
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const validateTickRef = useRef<{
    messageId: string;
    startTime: number;
    base: string;
    intervalId: ReturnType<typeof setInterval> | null;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortWithReasonRef = useRef<((reason: string) => void) | null>(null);
  const cancelValidationRef = useRef(false);
  const queueRef = useRef<QueuedMessage[]>([]);
  const processingRef = useRef(false);
  const hydratedRef = useRef(false);
  const serverPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const isTypingRef = useRef(false);
  const STREAM_IN_PROGRESS_KEY = "streamInProgress";

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      abortControllerRef.current?.abort();
      if (validateTickRef.current?.intervalId) clearInterval(validateTickRef.current.intervalId);
      validateTickRef.current = null;
      setValidateProgressMessageId(null);
      setValidateElapsedSeconds(-1);
      abortWithReasonRef.current = null;
      cancelValidationRef.current = false;
      if (serverPersistTimeoutRef.current) clearTimeout(serverPersistTimeoutRef.current);
      serverPersistTimeoutRef.current = null;
      setCanSend(true);
      isTypingRef.current = false;
      setIsTyping(false);
      setIsValidating(false);
      if (typeof window !== "undefined") localStorage.removeItem(STREAM_IN_PROGRESS_KEY);
    };
  }, []);

  // Persist chat on pagehide/refresh even if localStorage is full.
  useEffect(() => {
    const flush = () => {
      persistChatToServer(projectId, messagesRef.current);
      if (typeof window !== "undefined") localStorage.removeItem(STREAM_IN_PROGRESS_KEY);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [projectId]);

  const cancelCurrent = useCallback(() => {
    // Clear any queued follow-ups too.
    queueRef.current = [];
    cancelValidationRef.current = true;

    // If we're in the "Validating build on Mac…" phase, cancel UI updates and ignore completion.
    if (validateTickRef.current) {
      const messageId = validateTickRef.current.messageId;
      if (validateTickRef.current.intervalId) clearInterval(validateTickRef.current.intervalId);
      validateTickRef.current = null;
      setValidateProgressMessageId(null);
      setValidateElapsedSeconds(-1);
      setIsValidating(false);
      setBuildStatus("idle");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: "Build validation stopped." } : m
        )
      );
      return;
    }

    // Otherwise, cancel the streaming request (generation/edit).
    abortWithReasonRef.current?.(USER_CANCEL_REASON);
  }, []);

  // Restore chat history when returning to the editor for the same project.
  // Show localStorage immediately (already in initial state); fetch from server and replace when done.
  useEffect(() => {
    hydratedRef.current = false;
    setIsHydrating(true);
    let cancelled = false;
    setMessages(loadChatMessagesFromLocalStorage(projectId) ?? []);

    fetch(`/api/projects/${projectId}/chat`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const serverMsgs = Array.isArray(data?.messages) ? (data.messages as ChatMessage[]) : [];
        console.log("[hydration] streamInProgress:", localStorage.getItem(STREAM_IN_PROGRESS_KEY), "| serverMsgs.length:", serverMsgs.length);
        const streamInProgress = typeof window !== "undefined" ? localStorage.getItem(STREAM_IN_PROGRESS_KEY) : null;
        if (!streamInProgress) {
          if (serverMsgs.length > 0) {
            setMessages(serverMsgs);
            setBuildStatus("live");
            saveChatMessagesToLocalStorage(projectId, serverMsgs);
          } else {
            const local = loadChatMessagesFromLocalStorage(projectId);
            if (local && local.length > 0) {
              setMessages(local);
              setBuildStatus("live");
            }
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        const streamInProgress = typeof window !== "undefined" ? localStorage.getItem(STREAM_IN_PROGRESS_KEY) : null;
        if (!streamInProgress) {
          const local = loadChatMessagesFromLocalStorage(projectId);
          if (local && local.length > 0) {
            setMessages(local);
            setBuildStatus("live");
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          hydratedRef.current = true;
          setIsHydrating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Poll for chat updates so messages sent from iOS (or another tab) appear without refresh.
  const POLL_INTERVAL_MS = 4000;
  useEffect(() => {
    if (!projectId) return;
    const intervalId = setInterval(() => {
      console.log("[poll] isTypingRef:", isTypingRef.current, "| localStorage:", localStorage.getItem("streamInProgress"));
      if (!projectId || isTypingRef.current) return;
      fetch(`/api/projects/${projectId}/chat`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const serverMsgs = Array.isArray(data?.messages) ? (data.messages as ChatMessage[]) : [];
          const localLen = messagesRef.current.length;
          console.log("[poll] serverMsgs.length:", serverMsgs.length, "| messagesRef.current.length:", localLen);
          if (serverMsgs.length <= localLen) return;
          const local = messagesRef.current;
          const serverIds = new Set(serverMsgs.map((m) => m.id));
          const localOnlyStreamSteps = local.filter(
            (m) =>
              (m.id.startsWith("stream-phase-") || m.id.startsWith("stream-file-")) && !serverIds.has(m.id)
          );
          console.log("[poll] localOnlyStreamSteps found:", localOnlyStreamSteps.length);
          let merged: ChatMessage[];
          if (localOnlyStreamSteps.length === 0) {
            merged = serverMsgs;
          } else {
            const orderMap = new Map<string, number>();
            local.forEach((m, i) => orderMap.set(m.id, i));
            const serverWithOrder = serverMsgs.map((m, i) => ({
              m,
              order: orderMap.get(m.id) ?? 1e6 + i,
            }));
            const stepsWithOrder = localOnlyStreamSteps.map((m) => ({
              m,
              order: local.indexOf(m),
            }));
            merged = [...serverWithOrder, ...stepsWithOrder]
              .sort((a, b) => a.order - b.order)
              .map((x) => x.m);
          }
          console.log("[poll] merged ids:", merged.map((m) => m.id));
          const current = messagesRef.current;
          if (JSON.stringify(merged) !== JSON.stringify(current)) {
            setMessages(merged);
            saveChatMessagesToLocalStorage(projectId, merged);
          }
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [projectId]);

  // Persist chat history per project id.
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveChatMessagesToLocalStorage(projectId, messages);

    // Debounced server persistence of stable messages (backup for pagehide).
    if (serverPersistTimeoutRef.current) clearTimeout(serverPersistTimeoutRef.current);
    serverPersistTimeoutRef.current = setTimeout(() => {
      persistChatToServer(projectId, messages);
    }, 250);
  }, [projectId, messages]);

  const runClientMock = useCallback(
    (trimmed: string) => {
      const mock = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      const streamRunId = Date.now();

      const t1 = setTimeout(() => setBuildStatus("building"), 400);
      timeoutIdsRef.current.push(t1);

      setMessages((prev) => [
        ...prev,
        { id: `stream-progress-${streamRunId}`, role: "assistant" as const, content: "Planning next moves…" },
      ]);

      const steps: { delay: number; id: string; content: string }[] = [
        { delay: 4000, id: `stream-phase-${streamRunId}-thinking`, content: "Thinking…" },
        { delay: 6500, id: `stream-file-${streamRunId}-1`, content: "Creating App.swift" },
        { delay: 9000, id: `stream-file-${streamRunId}-2`, content: "Creating ContentView.swift" },
        { delay: 11500, id: `stream-phase-${streamRunId}-finalizing`, content: "Finalizing" },
        { delay: 14000, id: `stream-phase-${streamRunId}-done`, content: "Done" },
      ];
      steps.forEach(({ delay, id, content }) => {
        const t = setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id, role: "assistant" as const, content },
          ]);
        }, delay);
        timeoutIdsRef.current.push(t);
      });

      const tSummary = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}-summary`,
            role: "assistant" as const,
            content: mock.content,
            editedFiles: mock.editedFiles,
          },
        ]);
        isTypingRef.current = false;
        setIsTyping(false);
        setCanSend(true);
        setBuildStatus("live");
      }, 16500);
      timeoutIdsRef.current.push(tSummary);
    },
    []
  );

  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      processingRef.current = false;
      isTypingRef.current = false;
      setIsTyping(false);
      setBuildStatus((s) => (s === "building" ? "live" : s));
      if (typeof window !== "undefined") localStorage.removeItem(STREAM_IN_PROGRESS_KEY);
      return;
    }
    const item = queueRef.current.shift()!;
    const { text: trimmed, model: modelOption, projectType } = item;

    const ac = new AbortController();
    abortControllerRef.current = ac;
    let abortReason: string | null = null;
    const abortWithReason = (reason: string) => {
      abortReason = reason;
      try {
        ac.abort();
      } catch {
        // ignore
      }
    };
    abortWithReasonRef.current = abortWithReason;
    cancelValidationRef.current = false;

    setBuildStatus("building");

    const streamRunId = Date.now();
    const progressMessageId = `stream-progress-${streamRunId}`;
    const localStartedAt = Date.now();
    let sawServerProgress = false;
    let currentPhaseLabel = "Starting request";
    let lastReceivedChars = 0;
    let lastIncreaseAt = Date.now();
    let lastElapsedMs: number | undefined;
    let lastCostUsd: number | undefined;
    let lastProgressElapsedMs: number | undefined;
    let discoveredFilesCount = 0;
    const discoveredFilePaths: string[] = [];
    const emittedPhases = new Set<string>();

    setStreamProgressMessageId(progressMessageId);
    setStreamElapsedSeconds(0);
    setMessages((prev) => [
      ...prev,
      {
        id: progressMessageId,
        role: "assistant",
        content: "Planning next moves…",
      },
    ]);

    const formatCost = (usd: number | undefined) => {
      if (typeof usd !== "number") return "";
      return ` · ~$${usd < 0.005 ? "<0.01" : usd.toFixed(2)}`;
    };
    const formatTokens = (receivedChars: number) => {
      const approxTokens = Math.round(receivedChars / 4);
      if (approxTokens < 50) return "";
      return ` · ~${approxTokens >= 1000 ? (approxTokens / 1000).toFixed(1) + "k" : approxTokens} tokens`;
    };

    const renderProgressLine = (opts?: { receivedChars?: number; costUsd?: number }) => {
      const receivedChars =
        typeof opts?.receivedChars === "number" ? opts.receivedChars : lastReceivedChars;
      const costUsd =
        typeof opts?.costUsd === "number" ? opts.costUsd : lastCostUsd;

      // Single source of truth for elapsed time to avoid jumps/backtracking:
      // always use the local stopwatch (not server-provided elapsedMs).
      const elapsedSec = Math.max(1, Math.floor((Date.now() - localStartedAt) / 1000));
      const elapsedStr = ` · ${formatDurationShort(elapsedSec)}`;
      const tokenStr = formatTokens(receivedChars);
      const costStr = formatCost(costUsd);
      const fileCount = discoveredFilePaths.length || discoveredFilesCount;
      const basenames = discoveredFilePaths.map((p) => p.split("/").pop() ?? p);
      const maxNames = 6;
      const filesStr =
        fileCount > 0
          ? ` · ${basenames.length > 0 ? basenames.slice(0, maxNames).join(", ") + (basenames.length > maxNames ? ` +${basenames.length - maxNames} more` : "") : `${fileCount} file${fileCount === 1 ? "" : "s"}`}`
          : "";

      const idleSecs = Math.max(0, Math.round((Date.now() - lastIncreaseAt) / 1000));
      const showThinking =
        (currentPhaseLabel.startsWith("Receiving output") && idleSecs >= 7);
      const label = showThinking
        ? `Thinking… (no new tokens for ${idleSecs}s)`
        : currentPhaseLabel;

      return `${label}${filesStr}${tokenStr}${elapsedStr}${costStr}`;
    };

    const localTick = setInterval(() => {
      if (!sawServerProgress) {
        setStreamElapsedSeconds(Math.max(1, Math.floor((Date.now() - localStartedAt) / 1000)));
      }
    }, 1000);

    const watchdog = setInterval(() => {
      const elapsedMs = Date.now() - localStartedAt;
      if (!sawServerProgress) {
        if (elapsedMs > CONNECTING_TIMEOUT_MS) {
          abortWithReason("Request timed out while connecting. Try again.");
        }
        return;
      }

      if (lastReceivedChars <= 0) {
        if (elapsedMs > NO_OUTPUT_TIMEOUT_MS) {
          abortWithReason("Request timed out waiting for output. Try again.");
        }
        return;
      }

      const stalledMs = Date.now() - lastIncreaseAt;
      if (stalledMs > TOKEN_STALL_TIMEOUT_MS) {
        abortWithReason(
          `Request stalled (no new tokens for ${Math.max(1, Math.round(stalledMs / 1000))}s). Try again.`
        );
      }
    }, 2000);

    const removeStreamMessage = () => {
      clearInterval(localTick);
      clearInterval(watchdog);
      setStreamProgressMessageId(null);
      setStreamElapsedSeconds(-1);
      setMessages((prev) => prev.filter((m) => m.id !== progressMessageId));
    };

    const finish = (opts: { success?: boolean; error?: string; deferLive?: boolean }) => {
      clearInterval(watchdog);
      abortControllerRef.current = null;
      abortWithReasonRef.current = null;
      if (opts.error) {
        setBuildStatus("failed");
        removeStreamMessage();
        onError?.(opts.error);
      } else if (opts.success && !opts.deferLive) {
        setBuildStatus(queueRef.current.length > 0 ? "building" : "live");
      }
      processQueue();
    };

    fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: projectId, name: projectName ?? "Untitled app" }),
    })
      .then(() =>
        fetch(`/api/projects/${projectId}/message/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            model: modelOption ?? undefined,
            projectType,
            projectName: projectName ?? "Untitled app",
          }),
          signal: ac.signal,
        })
      )
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errorBody = typeof data?.error === "string" ? data.error : null;
          finish({
            error:
              errorBody || res.statusText || `Request failed (${res.status})`,
          });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          finish({ error: "No response body" });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        type DoneEvent = { type: "done"; assistantMessage: unknown; buildStatus?: string; projectFiles?: Array<{ path: string; content: string }>; skillIds?: string[] };
        let doneEvent: DoneEvent | null = null;
        let errorEvent: { type: "error"; error: string } | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              let event: {
                type: string;
                receivedChars?: number;
                estimatedCostUsdSoFar?: number;
                elapsedMs?: number;
                phase?: string;
                path?: string;
                count?: number;
                existing?: boolean;
                error?: string;
                assistantMessage?: unknown;
                buildStatus?: string;
              };
              try {
                event = JSON.parse(trimmedLine);
              } catch {
                continue;
              }
              if (event.type === "phase" && typeof event.phase === "string") {
                sawServerProgress = true;
                const phaseMap: Record<string, string> = {
                  starting_request: "Thinking…",
                  waiting_for_first_tokens: "Thinking…",
                  receiving_output: "Receiving output…",
                  validating_structured_output: "Finalizing",
                  saving_files: "Finalizing",
                  done_preview_updating: "Done",
                  retrying_request: "Retrying request…",
                };
                currentPhaseLabel = phaseMap[event.phase] ?? "Working";
                const emitKey = (event.phase === "starting_request" || event.phase === "waiting_for_first_tokens") ? "thinking" : event.phase;
                if (!emittedPhases.has(emitKey)) {
                  emittedPhases.add(emitKey);
                  if (event.phase === "receiving_output") continue;
                  if (event.phase === "saving_files") continue;
                  const label = phaseMap[event.phase] ?? event.phase;
                  const phaseMsg: ChatMessage = {
                    id: `stream-phase-${streamRunId}-${emitKey}`,
                    role: "assistant",
                    content: label,
                  };
                  setMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === progressMessageId);
                    const next = idx === -1 ? [...prev, phaseMsg] : (() => { const n = prev.slice(); n.splice(idx, 0, phaseMsg); return n; })();
                    persistChatToServer(projectId, next);
                    return next;
                  });
                }
              }
              if (event.type === "file" && typeof event.path === "string") {
                sawServerProgress = true;
                if (!discoveredFilePaths.includes(event.path)) discoveredFilePaths.push(event.path);
                if (typeof event.count === "number") discoveredFilesCount = event.count;
                const basename = event.path.split("/").pop() ?? event.path;
                const verb = event.existing === true ? "Editing" : "Creating";
                const fileMsg: ChatMessage = {
                  id: `stream-file-${streamRunId}-${typeof event.count === "number" ? event.count : Date.now()}`,
                  role: "assistant",
                  content: `${verb} ${basename}${typeof event.count === "number" ? ` (file ${event.count})` : ""}`,
                };
                setMessages((prev) => {
                  const idx = prev.findIndex((m) => m.id === progressMessageId);
                  const next = idx === -1 ? [...prev, fileMsg] : (() => { const n = prev.slice(); n.splice(idx, 0, fileMsg); return n; })();
                  const progressIdx = next.findIndex((m) => m.id === progressMessageId);
                  if (progressIdx !== -1)
                    next[progressIdx] = { ...next[progressIdx], content: renderProgressLine() };
                  persistChatToServer(projectId, next);
                  return next;
                });
              }
              if (event.type === "progress" && typeof event.receivedChars === "number") {
                sawServerProgress = true;
                const prevChars = lastReceivedChars;
                lastReceivedChars = event.receivedChars;
                if (event.receivedChars > prevChars) lastIncreaseAt = Date.now();
                lastCostUsd = event.estimatedCostUsdSoFar;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === progressMessageId
                      ? {
                          ...m,
                          content: renderProgressLine({
                            receivedChars: event.receivedChars,
                            costUsd: event.estimatedCostUsdSoFar,
                          }),
                        }
                      : m
                  )
                );
              } else if (event.type === "done" && event.assistantMessage) {
                doneEvent = event as DoneEvent;
                break;
              } else if (event.type === "error" && typeof event.error === "string") {
                errorEvent = { type: "error", error: event.error };
                break;
              }
            }
            if (doneEvent || errorEvent) break;
          }
        } catch (err) {
          if (err && typeof err === "object" && "name" in err && (err as Error).name === "AbortError") {
            finish({ error: abortReason ?? "Request timed out. Try again." });
            return;
          }
          finish({ error: err instanceof Error ? err.message : "Something went wrong." });
          return;
        }

        if (errorEvent) {
          finish({ error: errorEvent.error });
          return;
        }

        let deferLive = false;
        if (doneEvent) {
          onMessageSuccess?.();
          // Stop status updates immediately so the final assistant message can stream/render without being interrupted.
          clearInterval(localTick);
          let projectFiles = Array.isArray(doneEvent.projectFiles) ? doneEvent.projectFiles : [];
          if (projectFiles.length === 0) {
            try {
              const filesRes = await fetch(`/api/projects/${projectId}/files`);
              if (filesRes.ok) {
                const data = (await filesRes.json()) as { files?: Array<{ path: string; content: string }> };
                projectFiles = data.files ?? [];
              }
            } catch {
              // non-fatal
            }
          }
          if (projectFiles.length > 0) {
            saveProjectFilesToLocalStorage(projectId, projectFiles);
          }
          const am = doneEvent.assistantMessage as {
            id?: string;
            content?: string;
            editedFiles?: string[];
            usage?: { input_tokens: number; output_tokens: number };
            estimatedCostUsd?: number;
          };
          const rawContent = am?.content ?? "";
          let editedFiles = Array.isArray(am?.editedFiles) ? am.editedFiles : [];
          if (discoveredFilePaths.length > 0) {
            editedFiles = [
              ...discoveredFilePaths.filter((p) => editedFiles.includes(p)),
              ...editedFiles.filter((p) => !discoveredFilePaths.includes(p)),
            ];
          }
          const shouldPrefixBuilt = editedFiles.length > 0;
          const content =
            rawContent.trim().length === 0
              ? shouldPrefixBuilt
                ? "App built."
                : "Done."
              : shouldPrefixBuilt && !/^app built\b/i.test(rawContent.trim())
                ? `App built. ${rawContent}`
                : rawContent;
          const usage =
            am?.usage &&
            typeof am.usage.input_tokens === "number" &&
            typeof am.usage.output_tokens === "number"
              ? { input_tokens: am.usage.input_tokens, output_tokens: am.usage.output_tokens }
              : undefined;
          const estimatedCostUsd =
            typeof am?.estimatedCostUsd === "number" ? am.estimatedCostUsd : undefined;

          const autoTitle =
            isUntitledName(projectName)
              ? deriveTitleFromPrompt(trimmed) ?? deriveTitleFromSummary(rawContent)
              : null;
          let finalName: string | null = autoTitle && !isUntitledName(autoTitle) ? autoTitle : null;
          if (finalName) {
            try {
              const res = await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: finalName }),
              });
              if (res.ok) {
                const data = await res.json();
                if (typeof data?.name === "string" && data.name.trim()) finalName = data.name.trim();
              }
            } catch {
              /* use finalName as-is */
            }
            if (typeof finalName === "string") {
              updateProjectNameInLocalStorage(projectId, finalName);
              onProjectRenamed?.(finalName);
            }
          }
          const projectNameForLogs = finalName ?? projectName ?? "Unknown";
          const isProBuild =
            projectFiles.length > 0 &&
            projectFiles.some((f: { path: string }) => f.path.endsWith(".swift"));
          const validateMessageId = `validate-${Date.now()}`;
          const generationElapsedMs = Date.now() - localStartedAt;
          const contentWithTitle =
            finalName && !isUntitledName(finalName)
              ? `App name: ${finalName}\n\n${content}`
              : content;
          const realMessage: ChatMessage = {
            id: am?.id ?? validateMessageId,
            role: "assistant",
            content: contentWithTitle,
            editedFiles,
            ...(usage && { usage }),
            ...(estimatedCostUsd !== undefined && { estimatedCostUsd }),
            elapsedMs: generationElapsedMs,
            createdAt: Date.now(),
          };

          if (isProBuild && onProBuildComplete) {
            deferLive = true;
            setIsValidating(true);
            // Remove progress (spinner) only; keep stream-phase/stream-file steps, append validate line.
            setMessages((prev) => {
              const next = [
                ...prev.filter((m) => m.id !== progressMessageId),
                {
                  id: validateMessageId,
                  role: "assistant" as const,
                  content: `Finalizing… Waiting for runner… (${formatDurationShort(0)})`,
                editedFiles,
                ...(usage && { usage }),
                ...(estimatedCostUsd !== undefined && { estimatedCostUsd }),
                elapsedMs: generationElapsedMs,
                createdAt: Date.now(),
              },
              ];
              console.log("[build complete Pro] messages ids:", next.map((m) => m.id));
              return next;
            });
            const progressBase = "Finalizing… Waiting for runner…";
            setValidateProgressMessageId(validateMessageId);
            setValidateProgressBase(progressBase);
            setValidateElapsedSeconds(0);
            validateTickRef.current = {
              messageId: validateMessageId,
              startTime: Date.now(),
              base: progressBase,
              intervalId: null,
            };
            const tick = () => {
              const r = validateTickRef.current;
              if (!r) return;
              setValidateElapsedSeconds(Math.floor((Date.now() - r.startTime) / 1000));
            };
            const intervalId = setInterval(tick, 1000);
            validateTickRef.current.intervalId = intervalId;
            onProBuildComplete(
              projectId,
              (status) => {
                const formatted = formatStatusDurations(status);
                const base = formatted.replace(/\s*\([^)]*\)\s*$/, "").trim();
                if (validateTickRef.current) validateTickRef.current.base = base;
                setValidateProgressBase(base);
              }
            )
              .then((result) => {
                if (cancelValidationRef.current) {
                  setIsValidating(false);
                  cancelValidationRef.current = false;
                  return;
                }
                if (validateTickRef.current?.intervalId) clearInterval(validateTickRef.current.intervalId);
                const buildDuration = validateTickRef.current ? Date.now() - validateTickRef.current.startTime : 0;
                validateTickRef.current = null;
                setValidateProgressMessageId(null);
                setValidateElapsedSeconds(-1);
                setIsValidating(false);
                if (result.fixedFiles && result.fixedFiles.length > 0) {
                  saveProjectFilesToLocalStorage(projectId, result.fixedFiles);
                  editedFiles = result.fixedFiles.map((f) => f.path);
                }
                fetch("/api/build-results", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectId,
                    projectName: projectNameForLogs,
                    prompt: trimmed,
                    tier: "custom",
                    category: "",
                    compiled: result.status === "succeeded",
                    attempts: result.attempts ?? 1,
                    autoFixUsed: (result.attempts ?? 1) > 1,
                    compilerErrors: result.compilerErrors ?? [],
                    fileCount: editedFiles.length,
                    fileNames: result.fileNames ?? editedFiles,
                    durationMs: buildDuration,
                    skillsUsed: doneEvent?.skillIds ?? [],
                    ...(typeof estimatedCostUsd === "number" && estimatedCostUsd >= 0 && { generationCostUsd: estimatedCostUsd }),
                    ...(Array.isArray(result.errorHistory) && result.errorHistory.length > 0 && { errorHistory: result.errorHistory }),
                    ...(result.status === "failed" && result.error && { errorMessage: result.error }),
                  }),
                }).catch((err) => Sentry.captureException(err));
                const validationLine =
                  result.status === "succeeded"
                    ? "Build validated. Your app is ready—download from Run on device when you want to run on your iPhone."
                    : `Build validation failed after auto-fix: ${result.error ?? "Unknown error"}. Open Run on device to view logs or retry.`;
                const finalContent =
                  result.status === "succeeded"
                    ? `${content}\n\n${validationLine}`
                    : validationLine;
                const totalElapsedMs = Date.now() - localStartedAt;
                setMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === validateMessageId
                      ? { ...m, content: finalContent, editedFiles, ...(usage && { usage }), ...(estimatedCostUsd !== undefined && { estimatedCostUsd }), elapsedMs: totalElapsedMs, createdAt: Date.now() }
                      : m
                  );
                  persistChatToServer(projectId, next);
                  console.log("[build complete after validation] messages ids:", next.map((m) => m.id));
                  return next;
                });
                setBuildStatus(result.status === "succeeded" ? (queueRef.current.length > 0 ? "building" : "live") : "failed");
                if (result.status === "failed") onError?.(result.message ?? result.error ?? "Build failed");
                if (result.status === "succeeded") onAppBuilt?.();
              })
              .catch(() => {
                if (cancelValidationRef.current) {
                  setIsValidating(false);
                  cancelValidationRef.current = false;
                  return;
                }
                if (validateTickRef.current?.intervalId) clearInterval(validateTickRef.current.intervalId);
                validateTickRef.current = null;
                setValidateProgressMessageId(null);
                setValidateElapsedSeconds(-1);
                setIsValidating(false);
                fetch("/api/build-results", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectId,
                    projectName: projectNameForLogs,
                    prompt: trimmed,
                    tier: "custom",
                    category: "",
                    compiled: false,
                    attempts: 1,
                    autoFixUsed: false,
                    compilerErrors: ["Validation could not complete (error or timeout)"],
                    fileCount: editedFiles.length,
                    fileNames: editedFiles,
                    durationMs: 0,
                    skillsUsed: doneEvent?.skillIds ?? [],
                  }),
                }).catch((err) => Sentry.captureException(err));
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === validateMessageId
                      ? { ...m, content: "Build validation could not complete. Open Run on device to validate manually.", editedFiles, ...(usage && { usage }), ...(estimatedCostUsd !== undefined && { estimatedCostUsd }) }
                      : m
                  )
                );
                setBuildStatus("failed");
              });
          } else {
            setMessages((prev) => {
              const next = [...prev.filter((m) => m.id !== progressMessageId), realMessage];
              console.log("[build complete non-Pro] messages ids:", next.map((m) => m.id));
              return next;
            });
            if (editedFiles.length > 0) onAppBuilt?.();
          }
        }
        finish({ success: true, deferLive });
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          if (abortReason === USER_CANCEL_REASON) {
            removeStreamMessage();
            abortControllerRef.current = null;
            abortWithReasonRef.current = null;
            setBuildStatus(queueRef.current.length > 0 ? "building" : "idle");
            processQueue();
            return;
          }
          finish({ error: abortReason ?? "Request timed out. Try again." });
        } else {
          finish({ error: err?.message ?? "Something went wrong. Please try again." });
        }
      });
  }, [projectId, projectName, onProjectRenamed, onError, onMessageSuccess, onAppBuilt, onProBuildComplete]);

  const sendMessage = useCallback(
    (text: string, model?: string, projectType: "standard" | "pro" = "standard") => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (trimmed.length > MAX_MESSAGE_LENGTH) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed.slice(0, MAX_MESSAGE_LENGTH),
        createdAt: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        messagesRef.current = next;
        return next;
      });
      // Flush the user message promptly so a quick refresh doesn't lose it.
      persistChatToServer(projectId, messagesRef.current);

      if (featureFlags.useRealLLM) {
        queueRef.current.push({ text: trimmed, model, projectType });
        if (processingRef.current) return;
        processingRef.current = true;
        isTypingRef.current = true;
        setIsTyping(true);
        if (typeof window !== "undefined") localStorage.setItem(STREAM_IN_PROGRESS_KEY, "true");
        processQueue();
        return;
      }

      if (!canSend) return;
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      abortControllerRef.current?.abort();
      setCanSend(false);
      isTypingRef.current = true;
      setIsTyping(true);
      runClientMock(trimmed);
    },
    [canSend, processQueue, runClientMock]
  );

  return {
    messages,
    isTyping,
    isValidating,
    isHydrating,
    sendMessage,
    cancelCurrent,
    buildStatus,
    setBuildStatus,
    input,
    setInput,
    canSend,
    maxMessageLength: MAX_MESSAGE_LENGTH,
    streamProgressMessageId,
    streamElapsedSeconds,
    validateProgressMessageId,
    validateProgressBase,
    validateElapsedSeconds,
  };
}
