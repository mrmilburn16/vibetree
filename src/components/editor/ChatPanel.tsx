"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button, Textarea, DropdownSelect } from "@/components/ui";
import { ArrowUp, Sparkles, Square, X, Zap } from "lucide-react";
import { getRandomAppIdeaPrompt } from "@/lib/appIdeaPrompts";
import { AnthropicLogo, OpenAILogo } from "@/components/icons/LLMLogos";
import { BuildingIndicator } from "./BuildingIndicator";
import { ReadyIndicator } from "./ReadyIndicator";
import { FailedIndicator } from "./FailedIndicator";
import { ChatMessageList } from "./ChatMessageList";
import { GuidedModeWizard } from "./GuidedModeWizard";
import { useChat } from "./useChat";
import { useCredits } from "@/contexts/CreditsContext";
import { featureFlags } from "@/lib/featureFlags";
import { LLM_OPTIONS, DEFAULT_LLM } from "@/lib/llm-options";

const LLM_STORAGE_KEY = "vibetree-llm";
const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";
const GUIDED_MODE_STORAGE_KEY = "vibetree-guided-mode";

const PROJECT_TYPE_OPTIONS = [
  { value: "standard", label: "Standard (Expo)" },
  { value: "pro", label: "Pro (Swift)" },
] as const;

const CHAT_PLACEHOLDERS = [
  "e.g. A fitness tracker with activity rings",
  "e.g. A todo list with due dates",
  "e.g. A habit tracker with streaks",
  "e.g. A recipe app with ingredients list",
];

/** 5 one-click scenario prompts for demos / testing. */
const SCENARIO_BUTTONS: { label: string; prompt: string }[] = [
  { label: "Counter", prompt: "Build a simple counter app. One screen: large number and a + button. Persist the count in UserDefaults so it survives restarts. Clean, minimal." },
  { label: "Todo list", prompt: "Build a todo list app. One screen: text field to add a task, a list of tasks with delete, and persist the list in UserDefaults." },
  { label: "Fitness tracker", prompt: "Build a fitness tracking app with activity rings and a list of workouts." },
  { label: "Timer", prompt: "Build a countdown timer app. One screen: pick minutes, Start button, and a large countdown display. When it hits zero, show an alert. Simple and clear." },
  { label: "Mood tracker", prompt: "Build a mood tracker. One screen: pick today's mood (e.g. 5 emoji buttons), save with date, show last 7 entries in a list. Persist in UserDefaults." },
];

const LLM_OPTIONS_WITH_ICONS = LLM_OPTIONS.map((opt) => ({
  ...opt,
  icon:
    opt.value === "auto"
      ? <Zap className="h-4 w-4" />
      : opt.value.startsWith("gpt") || opt.value.startsWith("codex")
        ? <OpenAILogo />
        : <AnthropicLogo />,
}));

type PreflightResult = {
  runner: { ok: boolean; runnerId?: string };
  device: { ok: boolean; name?: string; id?: string };
  teamId: { ok: boolean; value?: string };
  files: { ok: boolean; count?: number };
};

async function fetchTeamIdForPreflight(): Promise<string> {
  try {
    const res = await fetch("/api/user/development-team", { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json()) as { developmentTeamId?: string };
    return typeof data.developmentTeamId === "string" ? data.developmentTeamId.trim() : "";
  } catch {
    return "";
  }
}

function StopBuildButton({
  projectId,
  onCancelled,
}: {
  projectId: string;
  onCancelled: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const handleStop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/build-jobs/active");
      const data = await res.json().catch(() => ({}));
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const job = jobs.find(
        (j: { request?: { projectId?: string }; status?: string; autoFixInProgress?: boolean }) =>
          j?.request?.projectId === projectId &&
          (j?.status === "queued" ||
            j?.status === "running" ||
            (j?.status === "failed" && j?.autoFixInProgress))
      );
      if (job?.id) {
        const cancelRes = await fetch(`/api/build-jobs/${job.id}/cancel`, { method: "POST" });
        if (cancelRes.ok) onCancelled();
      } else {
        onCancelled();
      }
    } catch {
      onCancelled();
    } finally {
      setLoading(false);
    }
  }, [projectId, onCancelled]);
  return (
    <button
      type="button"
      onClick={handleStop}
      disabled={loading}
      className="rounded bg-[var(--button-secondary-bg)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover)] disabled:opacity-50"
      title="Stop build and clear Live Activity"
      aria-label="Stop build"
    >
      {loading ? "Stopping…" : "Stop build"}
    </button>
  );
}

export function ChatPanel({
  projectId,
  projectName,
  buildFailureReason,
  onBuildStatusChange,
  onOutOfCredits,
  onError,
  onAppBuilt,
  onProBuildComplete,
  onProjectRenamed,
  onIsTypingChange,
}: {
  projectId: string;
  projectName?: string;
  /** When build status is failed, optional reason to show in the red badge. */
  buildFailureReason?: string | null;
  onBuildStatusChange: (status: "idle" | "building" | "live" | "failed") => void;
  onOutOfCredits?: () => void;
  onError?: (message: string) => void;
  /** Called when the agent finishes with built app files (e.g. to show a toast). */
  onAppBuilt?: () => void;
  /** When a Pro build completes, run validate on Mac and return result; useChat will post the result in chat. */
  onProBuildComplete?: (
    projectId: string,
    onProgress?: (status: string) => void
  ) => Promise<{ status: "succeeded" | "failed"; error?: string; message?: string }>;
  onProjectRenamed?: (name: string) => void;
  /** Called when the agent starts or stops typing (so Install can be disabled while generating). */
  onIsTypingChange?: (typing: boolean) => void;
}) {
  const [llm, setLlm] = useState(DEFAULT_LLM);
  const [projectType, setProjectType] = useState<"standard" | "pro">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(PROJECT_TYPE_STORAGE_KEY);
      if (stored === "pro" || stored === "standard") return stored;
      localStorage.setItem(PROJECT_TYPE_STORAGE_KEY, "pro");
    }
    return "pro";
  });
  const [guidedMode, setGuidedMode] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(GUIDED_MODE_STORAGE_KEY);
      if (stored === "false") return false;
    }
    return true;
  });
  const { hasCreditsForMessage, deduct, refresh: refreshCredits } = useCredits();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LLM_STORAGE_KEY);
      const option = LLM_OPTIONS.find((o) => o.value === stored);
      if (option && !option.disabled && stored != null) setLlm(stored);
    }
  }, []);

  const handleLlmChange = (value: string) => {
    setLlm(value);
    if (typeof window !== "undefined") localStorage.setItem(LLM_STORAGE_KEY, value);
  };

  const handleProjectTypeChange = (value: string) => {
    const next = value === "pro" ? "pro" : "standard";
    setProjectType(next);
    if (typeof window !== "undefined") localStorage.setItem(PROJECT_TYPE_STORAGE_KEY, next);
  };

  const handleGuidedModeToggle = (on: boolean) => {
    setGuidedMode(on);
    if (typeof window !== "undefined") localStorage.setItem(GUIDED_MODE_STORAGE_KEY, String(on));
  };

  const {
    messages,
    isTyping,
    isValidating,
    sendMessage,
    cancelCurrent,
    buildStatus,
    setBuildStatus,
    input,
    setInput,
    canSend,
    maxMessageLength,
    isHydrating,
    streamContentMessageId,
    streamElapsedSeconds,
    streamReceivedChars,
    validateProgressMessageId,
    validateProgressBase,
    validateElapsedSeconds,
  } = useChat(projectId, {
    onError,
    projectName,
    onProjectRenamed,
    onMessageSuccess: featureFlags.useRealLLM ? () => refreshCredits() : undefined,
    onAppBuilt,
    onProBuildComplete,
  });

  useEffect(() => {
    onBuildStatusChange(buildStatus);
  }, [buildStatus, onBuildStatusChange]);

  useEffect(() => {
    onIsTypingChange?.(isTyping);
  }, [isTyping, onIsTypingChange]);

  const [preflightChecks, setPreflightChecks] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const runPreflight = useCallback(async () => {
    if (!projectId) return;
    setPreflightLoading(true);
    try {
      const teamId = await fetchTeamIdForPreflight();
      const q = new URLSearchParams({ projectId });
      if (teamId) q.set("teamId", teamId);
      const res = await fetch(`/api/macos/preflight?${q.toString()}`);
      if (res.ok) {
        const data: PreflightResult = await res.json();
        setPreflightChecks(data);
      }
    } catch {
      setPreflightChecks(null);
    } finally {
      setPreflightLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectType !== "pro" || !projectId) return;
    runPreflight();
  }, [projectType, projectId, runPreflight]);

  const prevBuildStatusRef = useRef<typeof buildStatus>(undefined);
  useEffect(() => {
    const justBecameLive = buildStatus === "live" && prevBuildStatusRef.current !== "live";
    prevBuildStatusRef.current = buildStatus;
    if (projectType === "pro" && justBecameLive) runPreflight();
  }, [buildStatus, projectType, runPreflight]);

  const proPreflightReady =
    preflightChecks != null &&
    preflightChecks.runner.ok &&
    preflightChecks.device.ok &&
    preflightChecks.teamId.ok;
  // In mock mode (useRealLLM false) allow sending without runner/device/teamId so dev:mock works without Mac runner.
  const blockSendUntilPreflight =
    featureFlags.useRealLLM && projectType === "pro" && !proPreflightReady;

  // Auto-send a pending prompt from the dashboard (stored in localStorage before redirect).
  const pendingPromptSent = useRef(false);
  useEffect(() => {
    if (pendingPromptSent.current) return;
    if (messages.length > 0) return;
    const pending = localStorage.getItem("vibetree-pending-prompt");
    if (!pending) return;
    pendingPromptSent.current = true;
    localStorage.removeItem("vibetree-pending-prompt");
    if (guidedMode) handleGuidedModeToggle(false);
    setTimeout(() => {
      sendMessage(pending.trim(), llm, projectType);
    }, 100);
  }, [messages.length, sendMessage, llm, projectType, guidedMode]);

  const [justSent, setJustSent] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || !canSend) return;
      if (blockSendUntilPreflight) return;
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
    [input, canSend, blockSendUntilPreflight, sendMessage, llm, projectType, hasCreditsForMessage, deduct, onOutOfCredits]
  );

  const handleGuidedComplete = useCallback(
    (enrichedPrompt: string) => {
      if (blockSendUntilPreflight) return;
      if (!hasCreditsForMessage) {
        onOutOfCredits?.();
        return;
      }
      if (!featureFlags.useRealLLM && !deduct(1)) {
        onOutOfCredits?.();
        return;
      }
      sendMessage(enrichedPrompt, llm, projectType);
    },
    [blockSendUntilPreflight, sendMessage, llm, projectType, hasCreditsForMessage, deduct, onOutOfCredits]
  );

  const handleScenarioClick = useCallback(
    (prompt: string) => {
      const text = prompt.trim();
      if (!text || !canSend) return;
      if (blockSendUntilPreflight) return;
      if (!hasCreditsForMessage) {
        onOutOfCredits?.();
        return;
      }
      if (!featureFlags.useRealLLM && !deduct(1)) {
        onOutOfCredits?.();
        return;
      }
      sendMessage(text, llm, projectType);
    },
    [canSend, blockSendUntilPreflight, hasCreditsForMessage, deduct, onOutOfCredits, sendMessage, llm, projectType]
  );

  const showGuidedWizard = guidedMode && messages.length === 0 && !isTyping && !isHydrating;

  const canSendWithCredits = canSend && hasCreditsForMessage && !blockSendUntilPreflight;
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
    busy
      ? "Stop"
      : blockSendUntilPreflight
        ? "Complete Run on iPhone setup in Account Settings to send"
        : !canSend
          ? "Building…"
          : !hasCreditsForMessage
            ? "Out of credits"
            : "Send message (1 credit)";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, 120);
    el.style.height = `${h}px`;
  }, [input]);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-[minmax(220px,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-[var(--border-default)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3 overflow-visible">
          {(buildStatus === "building" || isValidating) && (
            <span className="shrink-0">
              <BuildingIndicator />
            </span>
          )}
          {(buildStatus === "building" || isValidating) && (
            <span className="shrink-0">
              <StopBuildButton
                projectId={projectId}
                onCancelled={() => {
                  setBuildStatus("failed");
                  cancelCurrent();
                }}
              />
            </span>
          )}
          {buildStatus === "live" && !isValidating && <ReadyIndicator label="Ready" />}
          {buildStatus === "failed" && <FailedIndicator reason={buildFailureReason} />}
          {!featureFlags.useRealLLM && (
            <span
              className="rounded bg-[var(--background-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]"
              title="Set NEXT_PUBLIC_USE_REAL_LLM=true in .env.local and restart the dev server for real AI responses."
            >
              Mock
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <DropdownSelect
            options={PROJECT_TYPE_OPTIONS}
            value={projectType}
            onChange={handleProjectTypeChange}
            aria-label="Build with Standard (Expo) or Pro (Swift)"
          />
          <DropdownSelect
            options={LLM_OPTIONS_WITH_ICONS}
            value={llm}
            onChange={handleLlmChange}
            aria-label="Select LLM for app design"
          />
        </div>
        <div className="min-w-0" aria-hidden />
      </div>

      {/* Run on iPhone readiness — single-line status */}
      {projectType === "pro" && (
        <div className="border-b border-[var(--border-default)] bg-[var(--background-secondary)]/50 px-4 py-2">
          {preflightLoading && !preflightChecks ? (
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-tertiary)]" />
              Checking…
            </span>
          ) : proPreflightReady ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
              <span className="text-yellow-400">Setup needed</span>
              <span className="text-[var(--text-tertiary)]">—</span>
              <Link href="/settings#iphone" className="text-[var(--link-default)] hover:underline">
                Account Settings
              </Link>
            </span>
          )}
        </div>
      )}

      {showGuidedWizard ? (
        <GuidedModeWizard
          projectType={projectType}
          onComplete={handleGuidedComplete}
          onSkip={() => handleGuidedModeToggle(false)}
          submitDisabled={blockSendUntilPreflight}
        />
      ) : (
        <ChatMessageList
          messages={messages}
          isTyping={isTyping}
          isHydrating={isHydrating}
          buildStatus={buildStatus}
          projectId={projectId}
          streamContentMessageId={streamContentMessageId}
          streamElapsedSeconds={streamElapsedSeconds}
          streamReceivedChars={streamReceivedChars}
          validateProgressMessageId={validateProgressMessageId}
          validateProgressBase={validateProgressBase}
          validateElapsedSeconds={validateElapsedSeconds}
          onEnterGuidedMode={
            messages.length === 0 && !guidedMode
              ? () => handleGuidedModeToggle(true)
              : undefined
          }
        />
      )}

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--border-default)] p-4 pt-4" style={{ background: "var(--chat-form-bg)" }}>
        <label htmlFor="chat-input" className="sr-only">
          Describe your app
        </label>
        <div className="min-w-0 flex flex-col">
          <div
            className={`flex min-h-[44px] items-center rounded-[26px] border-2 py-1 pr-1 pl-4 ring-0 transition-colors duration-[var(--transition-fast)] ${
              blockSendUntilPreflight
                ? "border-[var(--border-subtle)] bg-[var(--background-tertiary)]/50 opacity-90"
                : "border-[var(--input-border)] bg-[var(--input-bg)] focus-within:border-[var(--button-primary-bg)] focus-within:ring-2 focus-within:ring-[var(--button-primary-bg)]/30"
            }`}
          >
            <Textarea
              ref={textareaRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={blockSendUntilPreflight ? "Complete Run on iPhone setup in Account Settings to send…" : placeholderText}
              autoFocus={messages.length === 0 && !blockSendUntilPreflight}
              disabled={blockSendUntilPreflight}
              className="!border-0 !min-h-[38px] max-h-[112px] w-full resize-none bg-transparent pt-2 pb-3 pr-2 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] !shadow-none !ring-0 focus:!border-0 focus:!ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-90"
              style={{ resize: "none" }}
              rows={1}
              maxLength={maxMessageLength + 500}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!blockSendUntilPreflight) handleSubmit(e);
                }
              }}
            />
            {input.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setInput("")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                aria-label="Clear text"
                title="Clear text"
                disabled={blockSendUntilPreflight}
              >
                <X className="h-5 w-5 shrink-0" aria-hidden />
              </button>
            )}
            <Button
              type={busy ? "button" : "submit"}
              variant={busy ? "secondary" : "primary"}
              disabled={blockSendUntilPreflight || (busy ? false : (!canSendWithCredits || !input.trim() || input.length > maxMessageLength))}
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
                  <ArrowUp className="h-6 w-6 shrink-0" aria-hidden size={24} color="#FFFFFF" />
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-sm bg-current opacity-90" aria-hidden />
                )}
              </span>
            </Button>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-[var(--text-tertiary)]">Scenarios:</span>
              {SCENARIO_BUTTONS.map(({ label, prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleScenarioClick(prompt)}
                  disabled={busy || blockSendUntilPreflight || !canSendWithCredits}
                  className="inline-flex cursor-pointer items-center rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--button-primary-bg)]/50 hover:bg-[var(--button-primary-bg)]/10 hover:text-[var(--text-primary)] transition-colors disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`Run scenario: ${label}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInput(getRandomAppIdeaPrompt())}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--link-default)] transition-colors"
                aria-label="Fill with a random app idea from the list of 100"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Mystery app
              </button>
            </div>
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
