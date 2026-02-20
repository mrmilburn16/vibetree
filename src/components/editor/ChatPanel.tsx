"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button, Textarea, DropdownSelect } from "@/components/ui";
import { Send } from "lucide-react";
import { AnthropicLogo, OpenAILogo } from "@/components/icons/LLMLogos";
import { BuildingIndicator } from "./BuildingIndicator";
import { ReadyIndicator } from "./ReadyIndicator";
import { FailedIndicator } from "./FailedIndicator";
import { ChatMessageList } from "./ChatMessageList";
import { useChat } from "./useChat";
import { useCredits } from "@/contexts/CreditsContext";
import { LLM_OPTIONS, DEFAULT_LLM } from "@/lib/llm-options";

const LLM_STORAGE_KEY = "vibetree-llm";

const LLM_OPTIONS_WITH_ICONS = LLM_OPTIONS.map((opt) => ({
  ...opt,
  icon: opt.value.startsWith("gpt") ? <OpenAILogo /> : <AnthropicLogo />,
}));

export function ChatPanel({
  projectId,
  onBuildStatusChange,
  onOutOfCredits,
}: {
  projectId: string;
  onBuildStatusChange: (status: "idle" | "building" | "live" | "failed") => void;
  onOutOfCredits?: () => void;
}) {
  const [llm, setLlm] = useState(DEFAULT_LLM);
  const { hasCreditsForMessage, deduct } = useCredits();

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

  const [justSent, setJustSent] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || !canSend) return;
      if (!hasCreditsForMessage) {
        onOutOfCredits?.();
        return;
      }
      if (!deduct(1)) {
        onOutOfCredits?.();
        return;
      }
      sendMessage(text);
      setInput("");
      setJustSent(true);
      setTimeout(() => setJustSent(false), 80);
    },
    [input, canSend, sendMessage, hasCreditsForMessage, deduct, onOutOfCredits]
  );

  const canSendWithCredits = canSend && hasCreditsForMessage;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          {buildStatus === "building" && <BuildingIndicator />}
          {buildStatus === "live" && <ReadyIndicator label="Ready" />}
          {buildStatus === "failed" && <FailedIndicator />}
        </div>
        <DropdownSelect
          options={LLM_OPTIONS_WITH_ICONS}
          value={llm}
          onChange={handleLlmChange}
          aria-label="Select LLM for app design"
        />
      </div>

      <ChatMessageList messages={messages} isTyping={isTyping} />

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--border-default)] bg-[var(--background-primary)] p-4 pt-4">
        <div className="flex gap-2 items-center">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. A fitness tracker with activity rings"
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
            disabled={!canSendWithCredits || !input.trim() || input.length > maxMessageLength}
            className={`shrink-0 p-2.5 transition-transform duration-75 ${justSent ? "scale-95" : "scale-100"}`}
            aria-label={!canSend ? "Stop" : !hasCreditsForMessage ? "Out of credits" : "Send (1 credit)"}
          >
            {canSend ? (
              <Send className="h-4 w-4" aria-hidden />
            ) : (
              <span className="inline-block h-4 w-4 rounded-sm bg-current opacity-90" aria-hidden />
            )}
          </Button>
        </div>
        {input.length > maxMessageLength && (
          <p className="mt-2 text-caption text-[var(--semantic-error)]">
            Message too long (max {maxMessageLength} characters)
          </p>
        )}
        {!hasCreditsForMessage && (
          <p className="mt-2 text-caption text-[var(--semantic-warning)]">
            You&apos;re out of credits. <Link href="/credits" className="text-[var(--link-default)] hover:underline">Buy more</Link> to send messages.
          </p>
        )}
      </form>
    </div>
  );
}
