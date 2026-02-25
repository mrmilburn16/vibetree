"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button, Textarea, DropdownSelect } from "@/components/ui";
import { Send, Sparkles, Square } from "lucide-react";
import { getRandomAppIdeaPrompt } from "@/lib/appIdeaPrompts";
import { BuildingIndicator } from "./BuildingIndicator";
import { ReadyIndicator } from "./ReadyIndicator";
import { FailedIndicator } from "./FailedIndicator";
import { ChatMessageList } from "./ChatMessageList";
import { useChat } from "./useChat";
import { useCredits } from "@/contexts/CreditsContext";
import { featureFlags } from "@/lib/featureFlags";
import { LLM_OPTIONS, DEFAULT_LLM } from "@/lib/llm-options";

const LLM_STORAGE_KEY = "vibetree-llm";
const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";

const PROJECT_TYPE_OPTIONS = [
  { value: "standard", label: "Standard (Expo)" },
  { value: "pro", label: "Pro (Swift)" },
] as const;

const CHAT_PLACEHOLDERS = [
  "Describe your app. Example: A dark-themed todo app with 3 screens, camera access, and local storage",
  "Describe your app. Example: Build a habit tracker with streaks and run it on my phone",
  "Describe your app. Example: A fitness tracker with activity rings and weekly stats",
  "Describe your app. Example: A recipe app with ingredients list and save to device",
];

export function ChatPanel({
  projectId,
  projectName,
  buildFailureReason,
  onBuildStatusChange,
  onOutOfCredits,
  onError,
  onProBuildComplete,
  onProjectRenamed,
}: {
  projectId: string;
  projectName?: string;
  /** When build status is failed, optional reason to show in the red badge. */
  buildFailureReason?: string | null;
  onBuildStatusChange: (status: "idle" | "building" | "live" | "failed") => void;
  onOutOfCredits?: () => void;
  onError?: (message: string) => void;
  /** When a Pro build completes, run validate on Mac and return result; useChat will post the result in chat. */
  onProBuildComplete?: (
    projectId: string,
    onProgress?: (status: string) => void
  ) => Promise<{ status: "succeeded" | "failed"; error?: string }>;
  onProjectRenamed?: (name: string) => void;
}) {
  const [llm, setLlm] = useState(DEFAULT_LLM);
  const [projectType, setProjectType] = useState<"standard" | "pro">("standard");
  const { hasCreditsForMessage, deduct } = useCredits();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LLM_STORAGE_KEY);
      const option = LLM_OPTIONS.find((o) => o.value === stored);
      if (option && !option.disabled && stored != null) setLlm(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(PROJECT_TYPE_STORAGE_KEY);
      if (stored === "pro" || stored === "standard") setProjectType(stored);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") setLlm(detail);
    };
    window.addEventListener("vibetree-llm-changed", handler);
    return () => window.removeEventListener("vibetree-llm-changed", handler);
  }, []);

  const handleProjectTypeChange = (value: string) => {
    const next = value === "pro" ? "pro" : "standard";
    setProjectType(next);
    if (typeof window !== "undefined") localStorage.setItem(PROJECT_TYPE_STORAGE_KEY, next);
  };

  const {
    messages,
    isTyping,
    isValidating,
    sendMessage,
    cancelCurrent,
    buildStatus,
    input,
    setInput,
    canSend,
    maxMessageLength,
  } = useChat(projectId, {
    onError,
    projectName,
    onProjectRenamed,
    onMessageSuccess: featureFlags.useRealLLM ? () => deduct(1) : undefined,
    onProBuildComplete,
  });

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
      // Real LLM path: deduct only on success (onMessageSuccess). Mock path: deduct now.
      if (!featureFlags.useRealLLM && !deduct(1)) {
        onOutOfCredits?.();
        return;
      }
      sendMessage(text, llm, projectType);
      setInput("");
      setJustSent(true);
      setTimeout(() => setJustSent(false), 80);
    },
    [input, canSend, sendMessage, llm, projectType, hasCreditsForMessage, deduct, onOutOfCredits]
  );

  const canSendWithCredits = canSend && hasCreditsForMessage;
  const showCharCount = input.length > 0 && input.length >= 0.8 * maxMessageLength;
  const placeholderIndex = messages.length % CHAT_PLACEHOLDERS.length;
  const placeholderText =
    messages.length === 0
      ? CHAT_PLACEHOLDERS[placeholderIndex]
      : projectType === "pro"
        ? "Send a follow-up change (edits this app)… e.g. add a button, tweak layout, change colors"
        : "Send a follow-up change… e.g. add a screen, tweak styling, change behavior";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const busy = isTyping || isValidating;
  const sendButtonTitle =
    busy ? "Stop" : !canSend ? "Building…" : !hasCreditsForMessage ? "Out of credits" : "Send message (1 credit)";

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
          {buildStatus === "failed" && <FailedIndicator reason={buildFailureReason} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownSelect
            options={PROJECT_TYPE_OPTIONS}
            value={projectType}
            onChange={handleProjectTypeChange}
            aria-label="Build with Standard (Expo) or Pro (Swift)"
          />
        </div>
      </div>

      <ChatMessageList
        messages={messages}
        isTyping={isTyping}
        buildStatus={buildStatus}
        projectId={projectId}
      />

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--border-default)] p-4 pt-4" style={{ background: "var(--chat-form-bg)" }}>
        <label htmlFor="chat-input" className="sr-only">
          Describe your app
        </label>
        <div className="min-w-0 flex flex-col">
          <div
            className="flex min-h-[44px] items-center rounded-[26px] border-2 border-[var(--input-border)] bg-[var(--input-bg)] py-1 pr-1 pl-4 ring-0 transition-colors duration-[var(--transition-fast)] focus-within:border-[var(--button-primary-bg)] focus-within:ring-2 focus-within:ring-[var(--button-primary-bg)]/30"
          >
            <Textarea
              ref={textareaRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholderText}
              className="!border-0 !min-h-[38px] max-h-[112px] w-full resize-none bg-transparent pt-2 pb-3 pr-2 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] !shadow-none !ring-0 focus:!border-0 focus:!ring-0 focus:outline-none"
              style={{ resize: "none" }}
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
              type={busy ? "button" : "submit"}
              variant={busy ? "secondary" : "primary"}
              disabled={busy ? false : (!canSendWithCredits || !input.trim() || input.length > maxMessageLength)}
              onClick={busy ? cancelCurrent : undefined}
              className={`!flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 transition-transform duration-75 ${justSent ? "scale-95" : "scale-100"}`}
              aria-label={sendButtonTitle}
              title={sendButtonTitle}
            >
              <span className="flex size-full items-center justify-center">
                {busy ? (
                  <span
                    className="h-5 w-5 shrink-0 rounded-[4px] bg-[var(--border-default)]"
                    aria-hidden
                  />
                ) : canSend ? (
                  <Send className="h-6 w-6 shrink-0" aria-hidden size={24} />
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-sm bg-current opacity-90" aria-hidden />
                )}
              </span>
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInput(getRandomAppIdeaPrompt())}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--link-default)] transition-colors"
              aria-label="Fill with a random app idea from the list of 100"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Mystery app
            </button>
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
