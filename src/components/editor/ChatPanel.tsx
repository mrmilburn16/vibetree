"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const CHAT_PLACEHOLDERS = [
  "e.g. A fitness tracker with activity rings",
  "e.g. A todo list with due dates",
  "e.g. A habit tracker with streaks",
  "e.g. A recipe app with ingredients list",
];

const LLM_OPTIONS_WITH_ICONS = LLM_OPTIONS.map((opt) => ({
  ...opt,
  icon: opt.value.startsWith("gpt") ? <OpenAILogo /> : <AnthropicLogo />,
}));

export function ChatPanel({
  projectId,
  projectName,
  onBuildStatusChange,
  onOutOfCredits,
  onError,
}: {
  projectId: string;
  projectName?: string;
  onBuildStatusChange: (status: "idle" | "building" | "live" | "failed") => void;
  onOutOfCredits?: () => void;
  onError?: (message: string) => void;
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
  } = useChat(projectId, { onError, projectName });

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
      sendMessage(text, llm);
      setInput("");
      setJustSent(true);
      setTimeout(() => setJustSent(false), 80);
    },
    [input, canSend, sendMessage, llm, hasCreditsForMessage, deduct, onOutOfCredits]
  );

  const canSendWithCredits = canSend && hasCreditsForMessage;
  const showCharCount = input.length > 0 && input.length >= 0.8 * maxMessageLength;
  const placeholderIndex = messages.length % CHAT_PLACEHOLDERS.length;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendButtonTitle =
    !canSend ? "Building…" : !hasCreditsForMessage ? "Out of credits" : "Send message (1 credit)";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, 120);
    el.style.height = `${h}px`;
  }, [input]);

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

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--border-default)] p-4 pt-4" style={{ background: "var(--chat-form-bg)" }}>
        <label htmlFor="chat-input" className="sr-only">
          Describe your app
        </label>
        <div className="min-w-0 flex flex-col">
          <div
            className="flex min-h-[44px] items-center rounded-[24px] border-2 border-[var(--input-border)] bg-[var(--input-bg)] py-1 pr-1 pl-4 ring-0 transition-colors duration-[var(--transition-fast)] focus-within:border-[var(--button-primary-bg)] focus-within:ring-2 focus-within:ring-[var(--button-primary-bg)]/30"
          >
            <Textarea
              ref={textareaRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={CHAT_PLACEHOLDERS[placeholderIndex]}
              className="!border-0 !min-h-[38px] max-h-[112px] w-full resize-none bg-transparent pt-2 pb-3 pr-2 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] !shadow-none !ring-0 focus:!border-0 focus:!ring-0 focus:outline-none"
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
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 transition-transform duration-75 ${justSent ? "scale-95" : "scale-100"}`}
              aria-label={sendButtonTitle}
              title={sendButtonTitle}
            >
              {canSend ? (
                <Send className="h-4 w-4" aria-hidden />
              ) : (
                <span className="inline-block h-4 w-4 rounded-sm bg-current opacity-90" aria-hidden />
              )}
            </Button>
          </div>
          {showCharCount && (
<p className="mt-1.5 overflow-x-auto px-4 text-caption text-[var(--text-tertiary)]" role="status" aria-live="polite">
                {input.length > maxMessageLength ? (
                  <span className="whitespace-nowrap text-[var(--semantic-error)]">
                    Message too long (max {maxMessageLength.toLocaleString()} characters) — {input.length.toLocaleString()} / {maxMessageLength.toLocaleString()}
                  </span>
              ) : (
                <span className="block text-right">
                  {input.length.toLocaleString()} / {maxMessageLength.toLocaleString()}
                </span>
              )}
            </p>
          )}
        </div>
        {!hasCreditsForMessage && (
          <p className="mt-2 text-caption text-[var(--semantic-warning)]" role="status" aria-live="polite">
            You&apos;re out of credits. <Link href="/credits" className="text-[var(--link-default)] hover:underline">Buy more</Link> to send messages.
          </p>
        )}
      </form>
    </div>
  );
}
