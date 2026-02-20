"use client";

import { useState, useEffect } from "react";
import { Button, Textarea, Badge, DropdownSelect } from "@/components/ui";
import { ChatMessageList } from "./ChatMessageList";
import { useChat } from "./useChat";
import { LLM_OPTIONS, DEFAULT_LLM } from "@/lib/llm-options";

const LLM_STORAGE_KEY = "vibetree-llm";

export function ChatPanel({
  projectId,
  onBuildStatusChange,
}: {
  projectId: string;
  onBuildStatusChange: (status: "idle" | "building" | "live" | "failed") => void;
}) {
  const [llm, setLlm] = useState(DEFAULT_LLM);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LLM_STORAGE_KEY);
      if (stored && LLM_OPTIONS.some((o) => o.value === stored)) setLlm(stored);
    }
  }, []);

  const handleLlmChange = (value: string) => {
    setLlm(value);
    if (typeof window !== "undefined") localStorage.setItem(LLM_STORAGE_KEY, value);
  };
  const {
    messages,
    isTyping,
    sendMessage,
    buildStatus,
    input,
    setInput,
    canSend,
    maxMessageLength,
  } = useChat(projectId);

  useEffect(() => {
    onBuildStatusChange(buildStatus);
  }, [buildStatus, onBuildStatusChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !canSend) return;
    sendMessage(text);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-2.5">
        {buildStatus === "building" && (
          <Badge variant="building">Building…</Badge>
        )}
        {buildStatus === "live" && (
          <Badge variant="live">Ready</Badge>
        )}
        {buildStatus === "failed" && (
          <Badge variant="error">Failed</Badge>
        )}
      </div>

      <ChatMessageList messages={messages} isTyping={isTyping} />

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--border-default)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-caption text-[var(--text-tertiary)]">Model</span>
          <DropdownSelect
            options={LLM_OPTIONS}
            value={llm}
            onChange={handleLlmChange}
            aria-label="Select LLM for app design"
          />
        </div>
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the app you want to build…"
            className="min-h-[44px] min-w-0 flex-1 resize-none rounded-[24px] py-3 px-4"
            rows={1}
            maxLength={maxMessageLength + 500}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!canSend || !input.trim() || input.length > maxMessageLength}
            className="shrink-0"
            aria-label="Send"
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
