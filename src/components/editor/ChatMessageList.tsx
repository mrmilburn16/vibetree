"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui";
import type { ChatMessage } from "./useChat";

export function ChatMessageList({
  messages,
  isTyping,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.length === 0 && !isTyping && (
        <p className="text-body-muted text-sm">
          Describe the app you want. For example: &ldquo;A fitness tracker with activity rings&rdquo; or &ldquo;A todo app with categories&rdquo;.
        </p>
      )}
      <div className="space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={
              "animate-fade-in " +
              (msg.role === "user"
                ? "ml-auto max-w-[85%] rounded-xl bg-[var(--background-tertiary)] px-4 py-2.5 text-right"
                : "max-w-[85%] rounded-xl bg-[var(--background-secondary)] border border-[var(--border-default)] px-4 py-2.5")
            }
          >
            <p className="text-sm text-[var(--text-primary)]">{msg.content}</p>
            {msg.editedFiles && msg.editedFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {msg.editedFiles.map((file) => (
                  <Badge key={file} variant="neutral" className="text-xs">
                    {file}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex max-w-[85%] items-center gap-1 rounded-lg bg-[var(--background-secondary)] border border-[var(--border-default)] px-4 py-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--badge-neutral)]" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--badge-neutral)]" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--badge-neutral)]" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
