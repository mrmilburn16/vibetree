"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { StreamTimelineEntry } from "./useChat";
import { useCredits } from "@/contexts/CreditsContext";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDurationSec(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

function formatElapsedMs(ms: number): string {
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
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── BuildFeedback ─────────────────────────────────────────────────────────────

function BuildFeedback({ projectId }: { projectId?: string }) {
  const [submitted, setSubmitted] = useState(false);

  const handleRate = async (value: "up" | "down") => {
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
      <p className="mt-3 text-xs text-center text-[var(--text-tertiary)]">
        Thanks for the feedback!
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <p className="text-xs text-[var(--text-tertiary)]">How did the build turn out?</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleRate("up")}
          className="cursor-pointer rounded p-1.5 text-[var(--text-tertiary)] opacity-50 hover:opacity-100 hover:text-green-400 hover:bg-green-400/10 transition-all"
          title="Good build"
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleRate("down")}
          className="cursor-pointer rounded p-1.5 text-[var(--text-tertiary)] opacity-50 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
          title="Build had issues"
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── BuildProgressStream ──────────────────────────────────────────────────────

/**
 * Replaces StreamContentBubble during active LLM generation.
 * Renders a vertical timeline of status narration lines and file creation events,
 * with the active (last) item showing a pulsing background.
 */
export function BuildProgressStream({
  content,
  fileAnnotations: _fileAnnotations,
  streamTimeline,
  streamPendingStatus,
  isStreaming,
  streamElapsedSeconds,
  streamReceivedChars,
}: {
  content: string;
  fileAnnotations: string[];
  streamTimeline?: StreamTimelineEntry[];
  streamPendingStatus?: string;
  isStreaming: boolean;
  streamElapsedSeconds: number;
  streamReceivedChars: number;
}) {
  const timeline = streamTimeline ?? [];

  // Pending status: the incomplete current line being typed (no trailing \n yet).
  const hasPending =
    isStreaming &&
    typeof streamPendingStatus === "string" &&
    streamPendingStatus.trim().length > 0;

  // Active timeline index: -1 when pending is active (or stream done), otherwise last entry.
  const activeTimelineIdx =
    isStreaming && !hasPending && timeline.length > 0 ? timeline.length - 1 : -1;

  // "Generating app..." shown when nothing at all has arrived yet.
  const showInitialSpinner =
    isStreaming && timeline.length === 0 && !hasPending && content.trim().length === 0;

  // Footer: elapsed time + rough token count.
  const approxTokens = Math.round(streamReceivedChars / 4);
  const footerParts: string[] = [];
  if (streamElapsedSeconds >= 0) footerParts.push(formatDurationSec(streamElapsedSeconds));
  if (approxTokens >= 50)
    footerParts.push(
      `~${approxTokens >= 1000 ? (approxTokens / 1000).toFixed(1) + "k" : approxTokens} tokens`
    );

  return (
    <div className="max-w-[88%] py-0.5 chat-accent-full-box-v2 animate-chat-message-in">
      <div className="space-y-0.5">
        {/* Initial spinner before any content arrives */}
        {showInitialSpinner && (
          <div className="stream-row-active inline-block">
            <span className="text-xs status-step-shimmer">Generating app</span>
          </div>
        )}

        {timeline.map((entry, idx) => {
          const isActive = idx === activeTimelineIdx;
          const prevEntry = idx > 0 ? timeline[idx - 1] : null;
          // Add extra top margin before a status line that follows a file line.
          const needsGroupGap = entry.kind === "status" && prevEntry?.kind === "file";

          if (entry.kind === "status") {
            return (
              <div
                key={`s-${idx}`}
                className={isActive ? "stream-row-active" : ""}
                style={needsGroupGap ? { marginTop: "8px" } : undefined}
              >
                <span className={`text-xs ${isActive ? "status-step-shimmer" : "text-white"}`}>
                  {entry.text}
                </span>
              </div>
            );
          }

          // File entry
          const isDone = !isActive;
          return (
            <div
              key={`f-${idx}`}
              className={`flex items-center py-px ${isActive ? "stream-row-active" : ""}`}
            >
              {isDone ? (
                <span
                  className="shrink-0 mr-1.5 text-xs font-semibold"
                  style={{ color: "#1D9E75" }}
                  aria-label="done"
                >
                  ✓
                </span>
              ) : (
                <span
                  className="shrink-0 mr-1 font-mono text-xs text-[var(--border-subtle)]"
                  aria-hidden
                >
                  └──
                </span>
              )}
              {!isDone && (
                <span
                  className="shrink-0 text-[11px] text-[var(--text-secondary)]"
                  style={{ marginRight: "4px" }}
                >
                  {entry.existing ? "Editing" : "Creating"}
                </span>
              )}
              <span className={`font-mono text-[11px] ${isActive ? "status-step-shimmer" : "text-[var(--text-secondary)]"}`}>
                {entry.basename}
              </span>
            </div>
          );
        })}

        {/* Pending (incomplete) status line — the live text being typed */}
        {hasPending && (
          <div
            className="stream-row-active"
            style={timeline.length > 0 ? { marginTop: "8px" } : undefined}
          >
            <span className="text-xs status-step-shimmer">
              {streamPendingStatus!.trim()}
            </span>
          </div>
        )}
      </div>

      {footerParts.length > 0 && (
        <p
          className="mt-2 border-t border-[var(--border-subtle)]/50 pt-2 text-xs text-[var(--text-tertiary)]"
          aria-live="polite"
        >
          {footerParts.join(" · ")}
        </p>
      )}
    </div>
  );
}

// ─── CompileStatusRow ─────────────────────────────────────────────────────────

/**
 * Shown during the Xcode validate / auto-fix phase (validate-* message while
 * validateProgressMessageId is set). Replaces the old tick-by-tick text update.
 */
export function CompileStatusRow({
  validateProgressBase,
  validateElapsedSeconds,
}: {
  validateProgressBase: string;
  validateElapsedSeconds: number;
}) {
  const base = validateProgressBase.trim();
  const isAutoFix =
    /auto.fix/i.test(base) ||
    /attempt\s+\d/i.test(base) ||
    /fixing/i.test(base);

  const label = isAutoFix
    ? base || "Fixing build errors..."
    : "Compiling with Xcode...";

  const elapsed = validateElapsedSeconds >= 0 ? formatDurationSec(validateElapsedSeconds) : null;

  return (
    <div className="max-w-[88%] py-0.5 animate-chat-step-in">
      <div className="stream-row-active inline-flex items-center gap-0">
        <span
          className={`text-xs ${isAutoFix ? "" : "status-step-shimmer"}`}
          style={isAutoFix ? { color: "#BA7517" } : undefined}
        >
          {label}
        </span>
        {elapsed && (
          <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">({elapsed})</span>
        )}
      </div>
    </div>
  );
}

// ─── FinalBuildMessage ────────────────────────────────────────────────────────

/**
 * Shown after build completes (the final validate-* or assistant-* message).
 * Renders summary in a subtle card, then centered stats + feedback.
 */
export function FinalBuildMessage({
  content,
  editedFiles,
  elapsedMs,
  estimatedCostUsd,
  usage,
  createdAt,
  buildStatus,
  projectId,
  isLast,
}: {
  content: string;
  editedFiles?: string[];
  elapsedMs?: number;
  estimatedCostUsd?: number;
  usage?: { input_tokens: number; output_tokens: number };
  createdAt?: number;
  buildStatus?: string;
  projectId?: string;
  isLast: boolean;
}) {
  const { isOwner } = useCredits();
  const showFeedback = isLast && buildStatus === "live" && (editedFiles?.length ?? 0) > 0;

  // Strip server-added prefixes ("App name: ...\n\n", "App built. ").
  const stripped = content
    .replace(/^App name:[^\n]*\n\n/i, "")
    .replace(/^App built\.\s*/i, "")
    .trim();

  // Split out the build-validation suffix if present.
  const validationMatch = stripped.match(/\n\n(Build validated[\s\S]*|Build validation failed[\s\S]*)$/i);
  const validationPart = validationMatch ? validationMatch[1].trim() : null;
  const withoutValidation = validationMatch ? stripped.slice(0, validationMatch.index).trim() : stripped;

  // Extract only the descriptive sentence (PART 2 after the blank line).
  // Claude structures the summary as: narration lines\n\ndescription sentence
  const blankLineIdx = withoutValidation.indexOf("\n\n");
  const summaryPart =
    blankLineIdx >= 0
      ? withoutValidation.slice(blankLineIdx + 2).trim()
      : withoutValidation;

  const succeeded = validationPart ? /^Build validated/i.test(validationPart) : null;

  const timeAgo = createdAt ? formatTimeAgo(createdAt) : null;

  // Stats parts — cost and token counts are owner-only
  const statParts: string[] = [];
  if (elapsedMs != null) statParts.push(`Generated in ${formatElapsedMs(elapsedMs)}`);
  if (isOwner && estimatedCostUsd != null)
    statParts.push(
      `~$${estimatedCostUsd < 0.005 ? "<0.01" : estimatedCostUsd.toFixed(2)}`
    );
  if (isOwner && usage)
    statParts.push(
      `${(usage.input_tokens / 1000).toFixed(1)}k in / ${(usage.output_tokens / 1000).toFixed(1)}k out`
    );
  if (timeAgo) statParts.push(`Built ${timeAgo}`);

  return (
    <div className="max-w-[88%] py-0.5 animate-chat-message-in">
      {/* Summary card */}
      {summaryPart && (
        <div
          className="rounded-lg px-3 py-2.5 mb-2"
          style={{ background: "var(--background-secondary)" }}
        >
          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
            {summaryPart}
          </p>
        </div>
      )}

      {/* Build result line */}
      {succeeded === true && (
        <p className="text-xs font-medium mb-1" style={{ color: "#1D9E75" }}>
          ✓ Build succeeded
        </p>
      )}
      {succeeded === false && (
        <p className="text-xs font-medium mb-1" style={{ color: "#E24B4A" }}>
          ✗ Build failed
        </p>
      )}

      {/* Stats line — centered, muted */}
      {statParts.length > 0 && (
        <p
          className="text-center text-[var(--text-secondary)] mt-2"
          style={{ fontSize: "11px", opacity: 0.6 }}
        >
          {statParts.join(" · ")}
        </p>
      )}

      {/* Feedback */}
      {showFeedback && <BuildFeedback projectId={projectId} />}
    </div>
  );
}
