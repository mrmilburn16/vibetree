"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./useChat";

const STREAM_WORD_DELAY_MS = 45;

/** Split text into words (keeping spaces) for streamed reveal */
function getStreamTokens(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
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
    <div className="flex-1 overflow-y-auto p-5">
      {messages.length === 0 && !isTyping && (
        <h2 className="py-2 text-lg font-semibold text-[var(--text-primary)]">
          What do you want to build?
        </h2>
      )}
      <div className="space-y-6">
        {messages.map((msg) => {
          const isStreamingThis = msg.role === "assistant" && msg.id === streamingMessageId;
          const displayContent = isStreamingThis ? streamedContent : msg.content;
          const streamingComplete = !isStreamingThis || streamedContent === msg.content;
          const isFilesOnly = msg.role === "assistant" && msg.content === "" && msg.editedFiles?.length;

          return (
          <div
            key={msg.id}
            className={
              "animate-fade-in " +
              (msg.role === "user"
                ? "ml-auto w-fit max-w-[88%] rounded-2xl px-4 py-3 text-right shadow-sm " +
                  "bg-[var(--button-primary-bg)]/12 border border-[var(--button-primary-bg)]/20"
                : "max-w-[88%] py-0.5")
            }
          >
            {!isFilesOnly && (
              <p
                className={
                  msg.role === "user"
                    ? "text-sm font-medium text-[var(--text-primary)] leading-relaxed"
                    : "text-sm text-[var(--text-primary)] leading-relaxed"
                }
              >
                {displayContent}
                {isStreamingThis && streamedContent !== msg.content && (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--button-primary-bg)] align-middle" aria-hidden />
                )}
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
