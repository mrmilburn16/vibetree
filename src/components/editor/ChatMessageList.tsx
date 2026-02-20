"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./useChat";

const STREAM_WORD_DELAY_MS = 45;

/** Split text into words (keeping spaces) for streamed reveal */
function getStreamTokens(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

/** Short status phrases from useChat step messages */
const REASONING_PHRASES = new Set([
  "Reading files.",
  "Explored.",
  "Grepped.",
  "Analyzed.",
  "Planning next moves…",
  "Writing code…",
]);

function isReasoningMessage(msg: { role: string; content: string; editedFiles?: string[] }): boolean {
  if (msg.role !== "assistant" || (msg.editedFiles?.length ?? 0) > 0) return false;
  return msg.content.length < 50 || REASONING_PHRASES.has(msg.content.trim());
}

export function ChatMessageList({
  messages,
  isTyping,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamedContent, setStreamedContent] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, streamedContent]);

  // Stream assistant messages that have content (word-by-word)
  const streamStartedRef = useRef<string | null>(null);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.content.length === 0) return;

    const full = last.content;

    if (streamingMessageId !== last.id) {
      setStreamingMessageId(last.id);
      setStreamedContent("");
      streamStartedRef.current = null;
    }

    if (streamedContent === full) return;
    if (streamStartedRef.current === last.id) return;

    // Don't stream or show cursor for short reasoning steps — show them immediately
    if (isReasoningMessage(last)) {
      setStreamedContent(full);
      streamStartedRef.current = last.id;
      return;
    }
    streamStartedRef.current = last.id;

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
          const isFirstSummary =
            msg.role === "assistant" &&
            !isReasoning &&
            !messages.slice(0, index).some((m) => m.role === "assistant" && !isReasoningMessage(m));

          return (
          <div
            key={msg.id}
            className={
              (msg.role === "assistant" ? "animate-chat-message-in " : "animate-fade-in ") +
              (msg.role === "user"
                ? "ml-auto w-fit max-w-[88%] rounded-2xl px-4 py-3 text-right shadow-sm " +
                  "bg-[var(--background-secondary)] border border-[var(--border-default)] border-l-[var(--button-primary-bg)]/50"
                : "max-w-[88%] py-0.5") +
              (isFirstSummary ? " border-l-2 border-l-[var(--button-primary-bg)]/30 pl-2 ml-0.5" : "")
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
          </div>
          );
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
