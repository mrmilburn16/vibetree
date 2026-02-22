"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "./useChat";

const STREAM_WORD_DELAY_MS = 45;

/** Split text into words (keeping spaces) for streamed reveal */
function getStreamTokens(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

/** Short status phrases from useChat step messages — rendered muted (same as "Generating...", "Validating structured output") */
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
  // Status/progress messages should render immediately and update live (muted styling).
  if (typeof msg.id === "string" && msg.id.startsWith("stream-")) return true;
  if (msg.content.startsWith("Validating build on Mac…")) return true;
  return msg.content.length < 50 || REASONING_PHRASES.has(msg.content.trim());
}

export function ChatMessageList({
  messages,
  isTyping,
  onEnterGuidedMode,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
  onEnterGuidedMode?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamedContent, setStreamedContent] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, streamedContent]);

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
    <div className="flex flex-1 flex-col overflow-y-auto p-5">
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
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--button-primary-bg)]/30 bg-[var(--button-primary-bg)]/10 px-4 py-2 text-xs font-medium text-[var(--button-primary-bg)] hover:bg-[var(--button-primary-bg)]/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Try Guided Mode
            </button>
          )}
        </div>
      )}
      <div className="space-y-1">
        {messages.map((msg, index) => {
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
            {msg.role === "assistant" && streamingComplete && (msg.estimatedCostUsd != null || msg.usage) && (
              <p className="mt-2 text-xs text-[var(--text-tertiary)]" aria-live="polite">
                {msg.estimatedCostUsd != null && (
                  <span>~${msg.estimatedCostUsd < 0.005 ? "<0.01" : msg.estimatedCostUsd.toFixed(2)}</span>
                )}
                {msg.estimatedCostUsd != null && msg.usage && " · "}
                {msg.usage && (
                  <span>
                    {(msg.usage.input_tokens / 1000).toFixed(1)}k in / {(msg.usage.output_tokens / 1000).toFixed(1)}k out
                  </span>
                )}
              </p>
            )}
          </div>
          );
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
