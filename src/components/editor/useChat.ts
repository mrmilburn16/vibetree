"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { featureFlags } from "@/lib/featureFlags";

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
}

const PROJECT_FILES_STORAGE_PREFIX = "vibetree-project-files:";

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
    /** Called when the message API returns 200 (real LLM path only). Use for deduct-on-success. */
    onMessageSuccess?: () => void;
  }
) {
  const { onError, projectName, onMessageSuccess } = options ?? {};
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "live" | "failed">("idle");
  const [input, setInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  const MAX_MESSAGE_LENGTH = 4000;
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queueRef = useRef<QueuedMessage[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      abortControllerRef.current?.abort();
      setCanSend(true);
      setIsTyping(false);
    };
  }, []);

  const runClientMock = useCallback(
    (trimmed: string) => {
      const mock = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

      const t1 = setTimeout(() => setBuildStatus("building"), 400);
      timeoutIdsRef.current.push(t1);

      const stepMessages = [
        "Reading files.",
        "Explored.",
        "Grepped.",
        "Analyzed.",
        "Planning next moves…",
        "Writing code…",
      ];
      stepMessages.forEach((stepText, i) => {
        const t = setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: `assistant-${Date.now()}-${i}`, role: "assistant" as const, content: stepText },
          ]);
        }, 1000 + i * 1000);
        timeoutIdsRef.current.push(t);
      });

      const tSummary = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}-summary`, role: "assistant" as const, content: mock.content },
        ]);
      }, 7000);
      timeoutIdsRef.current.push(tSummary);

      const tFiles = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}-files`,
            role: "assistant" as const,
            content: "",
            editedFiles: mock.editedFiles,
          },
        ]);
        setIsTyping(false);
        setCanSend(true);
      }, 7500);
      timeoutIdsRef.current.push(tFiles);

      const tLive = setTimeout(() => setBuildStatus("live"), 8000);
      timeoutIdsRef.current.push(tLive);
    },
    []
  );

  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      processingRef.current = false;
      setIsTyping(false);
      setBuildStatus((s) => (s === "building" ? "live" : s));
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
    const emittedPhases = new Set<string>();

    setMessages((prev) => [
      ...prev,
      {
        id: progressMessageId,
        role: "assistant",
        content: "Connecting…",
      },
    ]);

    const formatCost = (usd: number | undefined) => {
      if (typeof usd !== "number") return "";
      return ` · ~$${usd < 0.005 ? "<0.01" : usd.toFixed(2)}`;
    };
    const formatElapsed = (ms: number | undefined) => {
      if (typeof ms !== "number") return "";
      return ` · ${Math.max(1, Math.round(ms / 1000))}s`;
    };
    const formatTokens = (receivedChars: number) => {
      const approxTokens = Math.round(receivedChars / 4);
      if (approxTokens < 50) return "";
      return ` · ~${approxTokens >= 1000 ? (approxTokens / 1000).toFixed(1) + "k" : approxTokens} tokens`;
    };

    const renderProgressLine = (opts?: { elapsedMs?: number; receivedChars?: number; costUsd?: number }) => {
      const elapsedMs =
        typeof opts?.elapsedMs === "number"
          ? opts.elapsedMs
          : typeof lastElapsedMs === "number"
            ? lastElapsedMs
            : undefined;
      const receivedChars =
        typeof opts?.receivedChars === "number" ? opts.receivedChars : lastReceivedChars;
      const costUsd =
        typeof opts?.costUsd === "number" ? opts.costUsd : lastCostUsd;

      const elapsedStr = formatElapsed(elapsedMs);
      const tokenStr = formatTokens(receivedChars);
      const costStr = formatCost(costUsd);
      const filesStr = discoveredFilesCount > 0 ? ` · ${discoveredFilesCount} files` : "";

      const idleSecs = Math.max(0, Math.round((Date.now() - lastIncreaseAt) / 1000));
      const showThinking =
        currentPhaseLabel === "Receiving output" && idleSecs >= 7;
      const label = showThinking
        ? `Thinking… (no new tokens for ${idleSecs}s)`
        : currentPhaseLabel;

      return `${label}${filesStr}${tokenStr}${elapsedStr}${costStr}`;
    };

    const localTick = setInterval(() => {
      const elapsedMs = Date.now() - localStartedAt;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== progressMessageId) return m;
          if (!sawServerProgress) {
            const elapsedStr = ` · ${Math.max(1, Math.round(elapsedMs / 1000))}s`;
            return { ...m, content: `Connecting…${elapsedStr}` };
          }
          // Keep the UI moving even if stream chunks are buffered.
          return { ...m, content: renderProgressLine({ elapsedMs }) };
        })
      );
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
      setMessages((prev) => prev.filter((m) => m.id !== progressMessageId));
    };

    const finish = (opts: { success?: boolean; error?: string }) => {
      clearInterval(watchdog);
      abortControllerRef.current = null;
      if (opts.error) {
        setBuildStatus("failed");
        removeStreamMessage();
        onError?.(opts.error);
      } else if (opts.success) {
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
        let doneEvent: { type: "done"; assistantMessage: unknown; buildStatus: string; projectFiles?: Array<{ path: string; content: string }> } | null = null;
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
                  starting_request: "Starting request",
                  waiting_for_first_tokens: "Waiting for first tokens",
                  receiving_output: "Receiving output",
                  validating_structured_output: "Validating structured output",
                  saving_files: "Saving files",
                  done_preview_updating: "Done / Preview updating",
                  retrying_request: "Retrying request",
                };
                currentPhaseLabel = phaseMap[event.phase] ?? "Working";
                if (!emittedPhases.has(event.phase)) {
                  emittedPhases.add(event.phase);
                  const phaseMsg: ChatMessage = {
                    id: `stream-phase-${streamRunId}-${event.phase}`,
                    role: "assistant",
                    content: `${currentPhaseLabel}${formatElapsed(event.elapsedMs)}`,
                  };
                  setMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === progressMessageId);
                    if (idx === -1) return [...prev, phaseMsg];
                    const next = prev.slice();
                    next.splice(idx, 0, phaseMsg);
                    return next;
                  });
                }
              }
              if (event.type === "file" && typeof event.path === "string") {
                sawServerProgress = true;
                if (typeof event.count === "number") discoveredFilesCount = event.count;
                const fileMsg: ChatMessage = {
                  id: `stream-file-${streamRunId}-${typeof event.count === "number" ? event.count : Date.now()}`,
                  role: "assistant",
                  content: `Generating ${event.path.split("/").pop() ?? event.path}${typeof event.count === "number" ? ` (file ${event.count})` : ""} · ${event.path}`,
                };
                setMessages((prev) => {
                  const idx = prev.findIndex((m) => m.id === progressMessageId);
                  if (idx === -1) return [...prev, fileMsg];
                  const next = prev.slice();
                  next.splice(idx, 0, fileMsg);
                  return next;
                });
              }
              if (event.type === "progress" && typeof event.receivedChars === "number") {
                sawServerProgress = true;
                const prevChars = lastReceivedChars;
                lastReceivedChars = event.receivedChars;
                if (event.receivedChars > prevChars) lastIncreaseAt = Date.now();
                lastElapsedMs = event.elapsedMs;
                lastCostUsd = event.estimatedCostUsdSoFar;
                lastProgressElapsedMs = event.elapsedMs;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === progressMessageId
                      ? {
                          ...m,
                          content: renderProgressLine({
                            elapsedMs: event.elapsedMs,
                            receivedChars: event.receivedChars,
                            costUsd: event.estimatedCostUsdSoFar,
                          }),
                        }
                      : m
                  )
                );
              } else if (event.type === "done" && event.assistantMessage) {
                doneEvent = event as NonNullable<typeof doneEvent>;
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

        if (doneEvent) {
          onMessageSuccess?.();
          // Stop status updates immediately so the final assistant message can stream/render without being interrupted.
          clearInterval(localTick);
          if (Array.isArray(doneEvent.projectFiles) && doneEvent.projectFiles.length > 0) {
            saveProjectFilesToLocalStorage(projectId, doneEvent.projectFiles);
          }
          const am = doneEvent.assistantMessage as {
            id?: string;
            content?: string;
            editedFiles?: string[];
            usage?: { input_tokens: number; output_tokens: number };
            estimatedCostUsd?: number;
          };
          const rawContent = am?.content ?? "";
          const editedFiles = Array.isArray(am?.editedFiles) ? am.editedFiles : [];
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
          const realMessage: ChatMessage = {
            id: am?.id ?? `assistant-${Date.now()}`,
            role: "assistant",
            content,
            editedFiles,
            ...(usage && { usage }),
            ...(estimatedCostUsd !== undefined && { estimatedCostUsd }),
          };
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== progressMessageId),
            realMessage,
          ]);
        }
        finish({ success: true });
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          finish({ error: abortReason ?? "Request timed out. Try again." });
        } else {
          finish({ error: err?.message ?? "Something went wrong. Please try again." });
        }
      });
  }, [projectId, projectName, onError, onMessageSuccess]);

  const sendMessage = useCallback(
    (text: string, model?: string, projectType: "standard" | "pro" = "standard") => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (trimmed.length > MAX_MESSAGE_LENGTH) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed.slice(0, MAX_MESSAGE_LENGTH),
      };
      setMessages((prev) => [...prev, userMsg]);

      if (featureFlags.useRealLLM) {
        queueRef.current.push({ text: trimmed, model, projectType });
        if (processingRef.current) return;
        processingRef.current = true;
        setIsTyping(true);
        processQueue();
        return;
      }

      if (!canSend) return;
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      abortControllerRef.current?.abort();
      setCanSend(false);
      setIsTyping(true);
      runClientMock(trimmed);
    },
    [canSend, processQueue, runClientMock]
  );

  return {
    messages,
    isTyping,
    sendMessage,
    buildStatus,
    input,
    setInput,
    canSend,
    maxMessageLength: MAX_MESSAGE_LENGTH,
  };
}
