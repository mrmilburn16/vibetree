"use client";

import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import type { ChatMessage } from "./useChat";

function formatElapsed(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

function formatTimeAgo(epochMs: number): string | null {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return null;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STREAM_WORD_DELAY_MS = 45;

/** Split text into words (keeping spaces) for streamed reveal */
function getStreamTokens(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

/** Short status phrases from useChat step messages — rendered muted */
const REASONING_PHRASES = new Set([
  "Reading files.",
  "Explored.",
  "Grepped.",
  "Analyzed.",
  "Planning next moves",
  "Planning next moves…",
  "Writing code…",
  "Thinking…",
  "Finalizing…",
  "Validating build on Mac…",
]);

function isReasoningMessage(msg: { id?: string; role: string; content: string; editedFiles?: string[] }): boolean {
  if (msg.role !== "assistant" || (msg.editedFiles?.length ?? 0) > 0) return false;
  if (typeof msg.id === "string" && msg.id.startsWith("stream-")) return true;
  if (msg.content.startsWith("Validating build on Mac…")) return true;
  return msg.content.length < 50 || REASONING_PHRASES.has(msg.content.trim());
}

function isStreamFileMessage(msg: ChatMessage): boolean {
  return typeof msg.id === "string" && msg.id.startsWith("stream-file-");
}

function isStreamStepMessage(msg: ChatMessage): boolean {
  if (typeof msg.id !== "string") return false;
  return (
    msg.id.startsWith("stream-progress-") ||
    msg.id.startsWith("stream-phase-") ||
    msg.id.startsWith("stream-file-")
  );
}

function getStreamRunId(msg: ChatMessage): string | null {
  if (typeof msg.id !== "string") return null;
  const parts = msg.id.split("-");
  if (parts[0] !== "stream" || !parts[2]) return null;
  return parts[2];
}

type StreamBlock = { start: number; steps: ChatMessage[]; runId: string; isActive: boolean };

/** Returns all stream blocks grouped by runId. Only the block containing the last stream-step message has isActive: true. */
function getAllStreamBlocks(messages: ChatMessage[]): StreamBlock[] {
  const blocks: StreamBlock[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (!isStreamStepMessage(msg)) {
      i++;
      continue;
    }
    const runId = getStreamRunId(msg);
    if (!runId) {
      i++;
      continue;
    }
    const start = i;
    const steps: ChatMessage[] = [];
    while (i < messages.length && isStreamStepMessage(messages[i]) && getStreamRunId(messages[i]) === runId) {
      steps.push(messages[i]);
      i++;
    }
    blocks.push({ start, steps, runId, isActive: false });
  }
  let lastStreamIndex = messages.length - 1;
  while (lastStreamIndex >= 0 && !isStreamStepMessage(messages[lastStreamIndex])) lastStreamIndex--;
  if (lastStreamIndex >= 0) {
    const activeBlock = blocks.find((b) => lastStreamIndex >= b.start && lastStreamIndex < b.start + b.steps.length);
    if (activeBlock) activeBlock.isActive = true;
  }
  return blocks;
}

/** Strip trailing " · Ns" for display in checklist. */
function stepDisplayLabel(content: string): string {
  return content.replace(/\s*·\s*\d+s?\s*$/i, "").replace(/\s*\(file \d+\)\s*$/i, "").trim() || content;
}

/** Strip trailing ellipsis (unicode … or ...) so we show only the animated dots. */
function stripTrailingEllipsis(text: string): string {
  return text.replace(/\s*(…|\.{3})\s*$/, "").trim() || text;
}

/** Use past tense for completed to-do items (Creating → Created, Editing → Edited). */
function toPastTense(label: string): string {
  if (/^Creating\s+/i.test(label)) return label.replace(/^Creating\s+/i, "Created ");
  if (/^Editing\s+/i.test(label)) return label.replace(/^Editing\s+/i, "Edited ");
  return label;
}

function isFileStep(msg: ChatMessage): boolean {
  return typeof msg.id === "string" && msg.id.startsWith("stream-file-");
}

function StreamTodoCard({
  steps,
  isTyping,
}: {
  steps: ChatMessage[];
  isTyping: boolean;
}) {
  const fileSteps = steps.filter(isFileStep);
  const firstFileIdx = steps.findIndex(isFileStep);
  const lastFileIdx = firstFileIdx >= 0 ? steps.length - 1 - [...steps].reverse().findIndex(isFileStep) : -1;
  const statusBeforeFiles = firstFileIdx < 0 ? steps : steps.slice(0, firstFileIdx);
  const statusAfterFiles = lastFileIdx >= 0 ? steps.slice(lastFileIdx + 1) : [];
  const lastStep = steps[steps.length - 1];
  const currentIsFile = lastStep ? isFileStep(lastStep) : false;
  const currentFileIndex = lastStep && currentIsFile ? fileSteps.findIndex((s) => s.id === lastStep.id) : -1;
  const totalTasks = fileSteps.length;
  const completedTasks = isTyping
    ? (currentIsFile ? currentFileIndex : fileSteps.length)
    : totalTasks;
  const lastBefore = statusBeforeFiles.filter((s) => !isFileStep(s)).pop();
  const lastAfter = statusAfterFiles.filter((s) => !isFileStep(s)).pop();
  const statusAbove =
    fileSteps.length === 0 && steps.length > 0
      ? (lastBefore ? stepDisplayLabel(lastBefore.content) : "Creating to-do list…")
      : lastBefore
        ? stepDisplayLabel(lastBefore.content)
        : null;
  const statusBelow = lastAfter ? stepDisplayLabel(lastAfter.content) : null;
  const isOnStatusAbove =
    fileSteps.length === 0
      ? isTyping
      : isTyping && lastBefore && lastStep?.id === lastBefore.id;
  const isOnStatusBelow = isTyping && lastAfter && lastStep?.id === lastAfter.id;

  return (
    <div className="mb-2">
      {statusAbove != null && (
        <p
          key={statusAbove}
          className={
            "mb-2 text-xs text-[var(--text-tertiary)] " +
            (isOnStatusAbove ? "chat-step-current text-[var(--text-secondary)]" : "")
          }
        >
          {isOnStatusAbove ? stripTrailingEllipsis(statusAbove) : statusAbove}
          {isOnStatusAbove && <span className="chat-step-dots ml-0.5 inline-block w-4" aria-hidden />}
        </p>
      )}
      <div className="rounded-lg border border-[var(--border-default)]/70 bg-[var(--background-secondary)]/60 px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]">
          <span>To-do</span>
          <span className="font-medium text-[var(--text-secondary)]">
            {totalTasks === 0 ? (isTyping ? "0 tasks" : "—") : `${completedTasks} of ${totalTasks} tasks`}
          </span>
        </div>
        <ul className="space-y-1.5" aria-live="polite">
          {fileSteps.map((step, idx) => {
            const isCurrent = isTyping && currentIsFile && currentFileIndex === idx;
            const isDone = !isCurrent && (!isTyping || currentFileIndex < 0 || idx < currentFileIndex);
            const label = stepDisplayLabel(step.content);
            return (
              <li
                key={step.id}
                className={
                  "flex items-center gap-2 text-sm transition-colors " +
                  (isCurrent
                    ? "chat-step-current text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]")
                }
              >
                {isDone ? (
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[var(--semantic-success)] bg-[var(--semantic-success)]/20 text-[10px] font-bold text-[var(--semantic-success)]"
                    aria-hidden
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border-2 border-white/50 bg-transparent"
                    aria-hidden
                  />
                )}
                <span>{isCurrent ? stripTrailingEllipsis(label) : isDone ? toPastTense(label) : label}</span>
                {isCurrent && <span className="chat-step-dots ml-0.5 inline-block w-4" aria-hidden />}
              </li>
            );
          })}
        </ul>
      </div>
      {statusBelow != null && (
        <p
          key={statusBelow}
          className={
            "mt-2 text-xs text-[var(--text-tertiary)] " +
            (isOnStatusBelow ? "chat-step-current text-[var(--text-secondary)]" : "")
          }
        >
          {isOnStatusBelow ? stripTrailingEllipsis(statusBelow) : statusBelow}
          {isOnStatusBelow && <span className="chat-step-dots ml-0.5 inline-block w-4" aria-hidden />}
        </p>
      )}
    </div>
  );
}

function BuildFeedback({ projectId }: { projectId?: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleRate = async (value: "up" | "down") => {
    setRating(value);
    setSubmitted(true);
    try {
      await fetch("/api/build-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, rating: value }),
      });
    } catch {
      // ignore
    }
  };

  if (submitted) {
    return (
      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
        Thanks for the feedback!
      </p>
    );
  }

  return (
    <div className="mt-2 flex items-center justify-center gap-2">
      <span className="text-xs text-[var(--text-tertiary)]">How did the build turn out?</span>
      <button
        type="button"
        onClick={() => handleRate("up")}
        className="cursor-pointer rounded p-1 text-[var(--text-tertiary)] hover:text-green-400 hover:bg-green-400/10 transition-colors"
        title="Good build"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleRate("down")}
        className="cursor-pointer rounded p-1 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
        title="Build had issues"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ChatMessageList({
  messages,
  isTyping,
  onEnterGuidedMode,
  buildStatus,
  projectId,
  isHydrating = false,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
  isHydrating?: boolean;
  onEnterGuidedMode?: () => void;
  buildStatus?: string;
  projectId?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamedContent, setStreamedContent] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const shouldAutoScrollRef = useRef(true);
  const lastForcedScrollUserMessageIdRef = useRef<string | null>(null);
  const lastScrollTopRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const pendingScrollBehaviorRef = useRef<ScrollBehavior>("auto");

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return false;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // A slightly larger threshold prevents flapping when content grows during streaming.
    return distanceFromBottom < 48;
  };

  const scheduleScrollToBottom = (behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (!el) return;

    // Prefer smooth if any caller requested it.
    if (behavior === "smooth") pendingScrollBehaviorRef.current = "smooth";

    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const target = scrollRef.current;
      if (!target) return;
      const b = pendingScrollBehaviorRef.current;
      pendingScrollBehaviorRef.current = "auto";
      target.scrollTo({ top: target.scrollHeight, behavior: b });
    });
  };

  const updateAutoScrollFlag = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 48;
    const scrollingUp = el.scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = el.scrollTop;

    setIsAtBottom((prev) => (prev === atBottom ? prev : atBottom));

    // Priority: if the user scrolls up, stop pinning to bottom immediately.
    if (scrollingUp && !atBottom) {
      shouldAutoScrollRef.current = false;
      return;
    }
    // Only re-enable auto-scroll once they've returned to the bottom.
    if (atBottom) shouldAutoScrollRef.current = true;
  };

  useEffect(() => {
    updateAutoScrollFlag();
  }, []);

  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    const lastIsNewUserMessage =
      last?.role === "user" && last.id !== lastForcedScrollUserMessageIdRef.current;

    if (lastIsNewUserMessage) {
      shouldAutoScrollRef.current = true;
      lastForcedScrollUserMessageIdRef.current = last.id;
    }

    if (!shouldAutoScrollRef.current) return;
    scheduleScrollToBottom(lastIsNewUserMessage ? "smooth" : "auto");
  }, [messages, isTyping]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    // When streaming grows the content, follow only if the user is already near the bottom.
    if (!isNearBottom()) return;
    scheduleScrollToBottom("auto");
  }, [streamedContent]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    };
  }, []);

  // Stream assistant messages that have content (word-by-word)
  const streamStartedKeyRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.content.length === 0) return;

    const full = last.content;
    const streamKey = `${last.id}:${full}`;

    if (streamingMessageId !== last.id) {
      setStreamingMessageId(last.id);
      setStreamedContent("");
      streamStartedKeyRef.current = null;
    }

    if (streamedContent === full) return;
    if (streamStartedKeyRef.current === streamKey) return;

    // On reload, messages are restored — show last message immediately, no animation
    if (isInitialMountRef.current) {
      setStreamedContent(full);
      streamStartedKeyRef.current = streamKey;
      isInitialMountRef.current = false;
      return;
    }

    // Validation status updates every second — show immediately so it doesn't retype on each tick
    if (last.content.startsWith("Validating build on Mac…") || last.content.startsWith("Finalizing…")) {
      setStreamedContent(full);
      streamStartedKeyRef.current = streamKey;
      return;
    }

    // Don't stream or show cursor for short reasoning steps — show them immediately
    if (isReasoningMessage(last)) {
      setStreamedContent(full);
      streamStartedKeyRef.current = streamKey;
      return;
    }
    streamStartedKeyRef.current = streamKey;

    const tokens = getStreamTokens(full);
    let tokenIndex = 0;
    let visible = "";

    const interval = setInterval(() => {
      if (tokenIndex >= tokens.length) {
        clearInterval(interval);
        setStreamedContent(full);
        return;
      }
      visible += tokens[tokenIndex];
      tokenIndex += 1;
      setStreamedContent(visible);
    }, STREAM_WORD_DELAY_MS);

    return () => clearInterval(interval);
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={updateAutoScrollFlag}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5"
      >
        {messages.length === 0 && !isTyping && isHydrating && (
          <div className="flex flex-1 flex-col justify-center py-12 animate-fade-in" style={{ animationDelay: "50ms" }} aria-busy="true" aria-label="Loading chat">
            <div className="mx-auto w-full max-w-md space-y-3 px-2">
              <div className="h-4 w-3/4 max-w-[14rem] rounded bg-[var(--background-tertiary)] animate-pulse" />
              <div className="h-3 w-full rounded bg-[var(--background-tertiary)]/80 animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-[var(--background-tertiary)]/80 animate-pulse" />
              <div className="mt-6 h-4 w-2/3 max-w-[10rem] rounded bg-[var(--background-tertiary)]/60 animate-pulse" />
              <div className="h-3 w-full rounded bg-[var(--background-tertiary)]/60 animate-pulse" />
            </div>
          </div>
        )}
        {messages.length === 0 && !isTyping && !isHydrating && (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center animate-fade-in" style={{ animationDelay: "50ms" }}>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              What do you want to build?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Describe your app in plain language—AI writes Swift and you preview live.
            </p>
            {onEnterGuidedMode && (
              <button
                type="button"
                onClick={onEnterGuidedMode}
                className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--button-primary-bg)]/30 bg-[var(--button-primary-bg)]/10 px-4 py-2 text-xs font-medium text-[var(--button-primary-bg)] hover:bg-[var(--button-primary-bg)]/20 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Try Guided Mode
              </button>
            )}
          </div>
        )}
        <div className="space-y-1">
          {(() => {
            const allBlocks = getAllStreamBlocks(messages);
            return messages.map((msg, index) => {
              const block = allBlocks.find((b) => index >= b.start && index < b.start + b.steps.length);
              if (block) {
                if (index === block.start) {
                  return (
                    <div key={`stream-block-${block.runId}`} className="animate-chat-step-in">
                      <StreamTodoCard steps={block.steps} isTyping={block.isActive && isTyping} />
                    </div>
                  );
                }
                return null;
              }

          const isStreamFile = isStreamFileMessage(msg);
          const isStreamingThis = msg.role === "assistant" && msg.id === streamingMessageId;
          const displayContent = isStreamingThis ? streamedContent : msg.content;
          const streamingComplete = !isStreamingThis || streamedContent === msg.content;
          const isFilesOnly = msg.role === "assistant" && msg.content === "" && msg.editedFiles?.length;
          const assistantIndex = messages.slice(0, index).filter((m) => m.role === "assistant").length;
          const staggerDelay =
            msg.role === "assistant" ? Math.min(assistantIndex * 40, 200) : 0;
          const isReasoning = isReasoningMessage(msg);
          const isAssistantSummary = msg.role === "assistant" && !isReasoning && !isStreamFile;
          const showAccent = isAssistantSummary;
          const displayContentForMessage = isStreamFile
            ? (msg.content.replace(/\s*\(file \d+\)\s*$/, "").trim())
            : displayContent;

          const isStepLine = (isReasoning || isStreamFile) && msg.role === "assistant";
          const stepStagger = isStepLine ? assistantIndex * 50 : 0;
          const assistantBoxClass = "max-w-[88%] py-0.5 chat-accent-full-box-v2";

          return (
          <div
            key={msg.id}
            className={
              (msg.role === "user"
                ? "animate-fade-in "
                : isStepLine
                  ? "animate-chat-step-in "
                  : "animate-chat-message-in ") +
              (msg.role === "user"
                ? "ml-auto w-fit max-w-[88%] rounded-2xl px-4 py-3 text-right shadow-sm " +
                  "bg-[var(--chat-bubble-user-bg)] border border-[var(--border-default)] border-l-[var(--chat-bubble-user-border-accent)]/50"
                : assistantBoxClass)
            }
            style={(staggerDelay > 0 || stepStagger > 0) ? { animationDelay: `${staggerDelay || stepStagger}ms` } : undefined}
          >
            {!isFilesOnly && (
              <p
                className={
                  msg.role === "user"
                    ? "text-sm font-medium text-[var(--text-primary)] leading-relaxed"
                    : isReasoning || isStreamFile
                      ? "text-sm text-[var(--text-primary)] leading-relaxed relative"
                      : "text-sm text-[var(--text-primary)] leading-relaxed"
                }
              >
                {isStepLine && (
                  <span
                    className="chat-step-dot absolute left-0 top-[0.35rem] h-2 w-2 rounded-full"
                    style={{ marginLeft: "-0.25rem" }}
                    aria-hidden
                  />
                )}
                <span className={isStepLine ? "block pl-3" : ""}>{displayContentForMessage}</span>
              </p>
            )}
            {msg.role === "assistant" && streamingComplete && (() => {
              const timeAgo = msg.createdAt ? formatTimeAgo(msg.createdAt) : null;
              const hasAny = msg.elapsedMs != null || msg.estimatedCostUsd != null || msg.usage || timeAgo;
              if (!hasAny) return null;
              const parts: React.ReactNode[] = [];
              if (msg.elapsedMs != null) parts.push(<span key="elapsed">Generated in {formatElapsed(msg.elapsedMs)}</span>);
              if (msg.estimatedCostUsd != null) parts.push(<span key="cost">~${msg.estimatedCostUsd < 0.005 ? "<0.01" : msg.estimatedCostUsd.toFixed(2)}</span>);
              if (msg.usage) parts.push(<span key="tokens">{(msg.usage.input_tokens / 1000).toFixed(1)}k in / {(msg.usage.output_tokens / 1000).toFixed(1)}k out</span>);
              if (timeAgo) parts.push(<span key="ago">Built {timeAgo}</span>);
              return (
                <p className="mt-2 text-xs text-[var(--text-tertiary)]" aria-live="polite">
                  {parts.map((p, i) => (<span key={i}>{i > 0 && " · "}{p}</span>))}
                </p>
              );
            })()}
            {msg.role === "assistant" &&
              streamingComplete &&
              msg.editedFiles?.length &&
              index === messages.length - 1 &&
              buildStatus === "live" && (
              <BuildFeedback projectId={projectId} />
            )}
          </div>
          );
            });
          })()}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
