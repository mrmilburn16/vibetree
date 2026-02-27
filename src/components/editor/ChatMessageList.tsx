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

/** Short status phrases from useChat step messages — rendered muted (same as "Writing...", "Validating structured output") */
const REASONING_PHRASES = new Set([
  "Reading files.",
  "Explored.",
  "Grepped.",
  "Analyzed.",
  "Planning next moves…",
  "Writing code…",
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

function StreamProgressBar({ messages }: { messages: ChatMessage[] }) {
  const fileMessages = messages.filter(isStreamFileMessage);
  if (fileMessages.length === 0) return null;

  const lastFile = fileMessages[fileMessages.length - 1];
  const countMatch = lastFile.content.match(/\(file (\d+)\)/);
  const currentCount = countMatch ? parseInt(countMatch[1], 10) : fileMessages.length;
  const fileNames = fileMessages.map((m) => {
    const match = m.content.match(/^Writing (.+?)(?:\s+\(file|$| ·)/);
    return match?.[1] ?? m.content;
  });

  return (
    <div className="mb-1 rounded-lg border border-[var(--border-default)]/50 bg-[var(--background-secondary)]/50 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>Building app…</span>
        <span className="font-mono">{currentCount} {currentCount === 1 ? "file" : "files"}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border-default)]/40">
        <div
          className="h-full rounded-full bg-[var(--button-primary-bg)] transition-all duration-300 ease-out"
          style={{ width: "100%" }}
        />
      </div>
      {fileNames.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
          {fileNames.slice(-8).map((name, i) => (
            <span key={i} className="text-[10px] font-mono text-[var(--text-tertiary)]/70">
              {name}
            </span>
          ))}
          {fileNames.length > 8 && (
            <span className="text-[10px] text-[var(--text-tertiary)]/50">
              +{fileNames.length - 8} more
            </span>
          )}
        </div>
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
    <div className="mt-2 flex items-center gap-2">
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
}: {
  messages: ChatMessage[];
  isTyping: boolean;
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

    // Validation status updates every second — show immediately so it doesn't retype on each tick
    if (last.content.startsWith("Validating build on Mac…")) {
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
        {messages.length === 0 && !isTyping && (
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
          {/* Consolidated progress bar for streaming file discovery */}
          {messages.some(isStreamFileMessage) && (
            <StreamProgressBar messages={messages} />
          )}
          {messages.map((msg, index) => {
          if (isStreamFileMessage(msg)) return null;
          const isStreamingThis = msg.role === "assistant" && msg.id === streamingMessageId;
          const displayContent = isStreamingThis ? streamedContent : msg.content;
          const streamingComplete = !isStreamingThis || streamedContent === msg.content;
          const isFilesOnly = msg.role === "assistant" && msg.content === "" && msg.editedFiles?.length;
          const assistantIndex = messages.slice(0, index).filter((m) => m.role === "assistant").length;
          const staggerDelay =
            msg.role === "assistant" ? Math.min(assistantIndex * 40, 200) : 0;
          const isReasoning = isReasoningMessage(msg);
          const isAssistantSummary = msg.role === "assistant" && !isReasoning;
          const showAccent = isAssistantSummary;

          return (
          <div
            key={msg.id}
            className={
              (msg.role === "assistant" ? "animate-chat-message-in " : "animate-fade-in ") +
              (msg.role === "user"
                ? "ml-auto w-fit max-w-[88%] rounded-2xl px-4 py-3 text-right shadow-sm " +
                  "bg-[var(--chat-bubble-user-bg)] border border-[var(--border-default)] border-l-[var(--chat-bubble-user-border-accent)]/50"
                : "max-w-[88%] py-0.5") +
              (showAccent ? " chat-accent-full-box-v2" : "")
            }
            style={staggerDelay > 0 ? { animationDelay: `${staggerDelay}ms` } : undefined}
          >
            {!isFilesOnly && (
              <p
                className={
                  msg.role === "user"
                    ? "text-sm font-medium text-[var(--text-primary)] leading-relaxed"
                    : isReasoning
                      ? "text-xs text-[var(--text-tertiary)] leading-relaxed"
                      : "text-sm text-[var(--text-primary)] leading-relaxed"
                }
              >
                {displayContent}
              </p>
            )}
            {msg.editedFiles && msg.editedFiles.length > 0 && (isFilesOnly || streamingComplete) && (
              <div className={isFilesOnly ? "mt-0" : "mt-3"}>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {msg.editedFiles.map((file, i) => (
                    <span key={file}>
                      {i > 0 && ", "}
                      <span className="font-mono text-[var(--text-secondary)]">{file}</span>
                    </span>
                  ))}
                </p>
              </div>
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
        })}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
