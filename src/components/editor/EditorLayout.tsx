"use client";

import * as Sentry from "@sentry/nextjs";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Settings, Smartphone, Share2, Keyboard, Monitor } from "lucide-react";
import { Button, BetaBadge, Toast } from "@/components/ui";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { LowCreditBanner } from "@/components/credits/LowCreditBanner";
import type { Project } from "@/lib/projects";
import { ChatPanel } from "./ChatPanel";
import { PreviewPane } from "./PreviewPane";
import { ProjectSettingsModal } from "./ProjectSettingsModal";
import { RunOnDeviceModal } from "./RunOnDeviceModal";
import { ShareModal } from "./ShareModal";
import { OutOfCreditsModal } from "./OutOfCreditsModal";
import { useSimulatorWallet } from "@/hooks/useSimulatorWallet";
import {
  SimulatorTopUpModal,
  SimulatorConfirmModal,
  SimulatorSessionPill,
  SimulatorSummaryModal,
  SimulatorBalanceRanOutModal,
} from "./SimulatorModals";

const CHAT_WIDTH_KEY = "vibetree-editor-chat-width";
const CHAT_WIDTH_MIN = 300;
const CHAT_WIDTH_MAX = 560;
const CHAT_WIDTH_DEFAULT = 420;

const PROJECT_FILES_PREFIX = "vibetree-project-files:";
const XCODE_TEAM_ID_PREFIX = "vibetree-xcode-team-id:";
const XCODE_BUNDLE_ID_OVERRIDE_PREFIX = "vibetree-xcode-bundle-id:";
const VALIDATE_POLL_MS = 2000;
const VALIDATE_TIMEOUT_MS = 30 * 60 * 1000;

function formatValidateProgress(job: { status?: string; startedAt?: number; createdAt?: number; autoFixInProgress?: boolean; request?: { attempt?: number; maxAttempts?: number } }): string {
  const status = job?.status ?? "queued";
  const elapsed = Math.floor((Date.now() - (job?.startedAt ?? job?.createdAt ?? Date.now())) / 1000);
  const attempt = job?.request?.attempt ?? 1;
  const maxAttempts = job?.request?.maxAttempts ?? 5;
  const prefix = "Validating build on Mac…";
  if (job?.autoFixInProgress || (status === "failed" && attempt < maxAttempts)) {
    return `${prefix} Auto-fixing Swift errors with AI… (${elapsed}s) · Attempt ${attempt}/${maxAttempts}`;
  }
  if (attempt > 1 && (status === "queued" || status === "running")) {
    return `${prefix} Rebuilding after fix… (${elapsed}s) · Attempt ${attempt}/${maxAttempts}`;
  }
  if (status === "queued") return `${prefix} Waiting for runner… (${elapsed}s)`;
  if (status === "running") return `${prefix} Building with xcodebuild… (${elapsed}s)`;
  return `${prefix} (${elapsed}s)`;
}

function getStoredChatWidth(): number {
  if (typeof window === "undefined") return CHAT_WIDTH_DEFAULT;
  const stored = localStorage.getItem(CHAT_WIDTH_KEY);
  if (stored === null) return CHAT_WIDTH_DEFAULT;
  const n = parseInt(stored, 10);
  if (!Number.isInteger(n) || n < CHAT_WIDTH_MIN || n > CHAT_WIDTH_MAX) return CHAT_WIDTH_DEFAULT;
  return n;
}

export function EditorLayout({
  project,
  onProjectSaved,
}: {
  project: Project;
  /** Called after project settings are saved so the parent can refresh project from storage. */
  onProjectSaved?: () => void;
}) {
  const [projectName, setProjectName] = useState(project.name);
  useEffect(() => {
    if (project?.name) setProjectName(project.name);
  }, [project?.name]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runOnDeviceOpen, setRunOnDeviceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "live" | "failed">("idle");
  const [buildFailureReason, setBuildFailureReason] = useState<string | null>(null);
  const [runnerOnline, setRunnerOnline] = useState<boolean | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [expoUrl, setExpoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "warning" | "error" | "info" } | null>(null);
  const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [runOnDeviceTitle, setRunOnDeviceTitle] = useState("Preview on your iPhone with Expo Go");
  const { balanceCents, planId, refresh: refreshSimulatorWallet, canUseSimulator } = useSimulatorWallet();
  const [simulatorTopUpOpen, setSimulatorTopUpOpen] = useState(false);
  const [simulatorConfirmOpen, setSimulatorConfirmOpen] = useState(false);
  const [simulatorSession, setSimulatorSession] = useState<{
    startTime: number;
    initialBalanceCents: number;
    deductedCents: number;
    liveBalanceCents: number;
  } | null>(null);
  const [simulatorSummary, setSimulatorSummary] = useState<{
    sessionSeconds: number;
    costCents: number;
    balanceAfterCents: number;
  } | null>(null);
  const [simulatorBalanceRanOutOpen, setSimulatorBalanceRanOutOpen] = useState(false);
  const simulatorDeductIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundInstallJobIdRef = useRef<string | null>(null);
  const [backgroundInstallStatus, setBackgroundInstallStatus] = useState<"idle" | "building" | "ready" | "failed">("idle");

  useEffect(() => {
    setChatWidth(getStoredChatWidth());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRunOnDeviceTitle(
      localStorage.getItem("vibetree-project-type") === "pro"
        ? "Install and run on your iPhone"
        : "Preview on your iPhone with Expo Go",
    );
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "r" && !e.shiftKey) {
        e.preventDefault();
        setRunOnDeviceOpen(true);
      } else if (e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        setShareOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Simulator session: deduct every 60 seconds at $0.20/min (20 cents/min)
  useEffect(() => {
    if (!simulatorSession) return;
    const deduct = async () => {
      try {
        const res = await fetch("/api/simulator-wallet/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents: 20 }),
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const newBalance = data.balanceCents ?? 0;
        setSimulatorSession((s) =>
          s
            ? {
                ...s,
                deductedCents: s.deductedCents + 20,
                liveBalanceCents: newBalance,
              }
            : null
        );
        if (newBalance <= 0) {
          if (simulatorDeductIntervalRef.current) {
            clearInterval(simulatorDeductIntervalRef.current);
            simulatorDeductIntervalRef.current = null;
          }
          setSimulatorSession(null);
          setSimulatorBalanceRanOutOpen(true);
        }
      } catch {
        // ignore
      }
    };
    simulatorDeductIntervalRef.current = setInterval(deduct, 60 * 1000);
    return () => {
      if (simulatorDeductIntervalRef.current) {
        clearInterval(simulatorDeductIntervalRef.current);
        simulatorDeductIntervalRef.current = null;
      }
    };
  }, [simulatorSession?.startTime]);

  useEffect(() => {
    if (!project.id) return;
    const isPro =
      typeof window !== "undefined" && localStorage.getItem("vibetree-project-type") === "pro";
    if (isPro) return;
    fetch(`/api/projects/${project.id}/run-on-device?projectType=standard`)
      .then((res) => res.json())
      .then((data) => { if (data.expoUrl) setExpoUrl(data.expoUrl); })
      .catch((err) => Sentry.captureException(err));
  }, [project.id]);

  const latestWidthRef = useRef(chatWidth);
  latestWidthRef.current = chatWidth;

  const handleResizerDoubleClick = useCallback(() => {
    setChatWidth(CHAT_WIDTH_DEFAULT);
    localStorage.setItem(CHAT_WIDTH_KEY, String(CHAT_WIDTH_DEFAULT));
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = chatWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, startWidth + delta));
      setChatWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsResizing(false);
      localStorage.setItem(CHAT_WIDTH_KEY, String(Math.round(latestWidthRef.current)));
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [chatWidth]);

  const onProBuildComplete = useCallback(
    async (
      projectId: string,
      onProgress?: (status: string) => void
    ): Promise<{
      status: "succeeded" | "failed";
      error?: string;
      fixedFiles?: Array<{ path: string; content: string }>;
      attempts?: number;
      compilerErrors?: string[];
      errorHistory?: Array<{ attempt: number; errors: string[] }>;
      fileNames?: string[];
      sourceFiles?: Array<{ path: string; content: string }>;
    }> => {
      if (typeof window === "undefined") return { status: "failed", error: "Not in browser" };
      let files: Array<{ path: string; content: string }> = [];
      let projectName = "Untitled app";
      let bundleId = "";
      let teamId = "";
      let bundleIdOverride = "";
      try {
        const raw = localStorage.getItem(`${PROJECT_FILES_PREFIX}${projectId}`);
        const parsed = raw ? JSON.parse(raw) : null;
        const storedFiles = Array.isArray(parsed?.files) ? parsed.files : [];
        if (storedFiles.length > 0) {
          try {
            localStorage.setItem(`${PROJECT_FILES_PREFIX}${projectId}`, JSON.stringify({ updatedAt: Date.now() }));
          } catch {
            // ignore
          }
        }
        files = [];
        const projectsRaw = localStorage.getItem("vibetree-projects");
        const projects = projectsRaw ? JSON.parse(projectsRaw) : [];
        const p = Array.isArray(projects) ? projects.find((x: { id?: string }) => x?.id === projectId) : null;
        if (p?.name) projectName = String(p.name);
        if (p?.bundleId) bundleId = String(p.bundleId);
        teamId = localStorage.getItem(`${XCODE_TEAM_ID_PREFIX}${projectId}`) ?? "";
        if (!teamId) {
          const universal = localStorage.getItem("vibetree-universal-defaults");
          if (universal) {
            try {
              const parsed = JSON.parse(universal);
              if (typeof parsed.teamId === "string") teamId = parsed.teamId;
            } catch {}
          }
        }
        bundleIdOverride = localStorage.getItem(`${XCODE_BUNDLE_ID_OVERRIDE_PREFIX}${projectId}`) ?? "";
      } catch {
        return { status: "failed", error: "Could not read project data" };
      }
      const finalBundleId = (bundleIdOverride.trim() || bundleId) || "com.vibetree.app";
      const res = await fetch(`/api/projects/${projectId}/validate-xcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(files.length > 0 ? { files } : {}),
          projectName,
          bundleId: finalBundleId,
          developmentTeam: teamId.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          status: "failed",
          error: (data?.message ?? data?.error ?? "Validation request failed") as string,
        };
      }
      const data = await res.json().catch(() => ({}));
      let jobId: string | null = typeof data?.job?.id === "string" ? data.job.id : null;
      if (!jobId) return { status: "failed", error: "No job id returned" };
      const deadline = Date.now() + VALIDATE_TIMEOUT_MS;
      onProgress?.("Validating build on Mac… Waiting for runner… (0s)");
      while (Date.now() < deadline) {
        const jobRes: Response = await fetch(`/api/build-jobs/${jobId}`);
        if (!jobRes.ok) break;
        const jobData = await jobRes.json().catch(() => ({}));
        const job = jobData?.job;
        const status = typeof job?.status === "string" ? job.status : null;
        const nextJobId = typeof job?.nextJobId === "string" ? job.nextJobId : null;
        onProgress?.(formatValidateProgress(job ?? {}));
        // Never treat as success when the build log contains ** BUILD FAILED ** (xcodebuild failure).
        const buildLogText = Array.isArray(job?.logs) ? job.logs.join("\n") : "";
        const logShowsBuildFailed = buildLogText.includes("** BUILD FAILED **");
        if (status === "succeeded" && !logShowsBuildFailed) {
          // Fire-and-forget: kick off background device build so it is ready when user clicks Install on iPhone
          (() => {
            fetch(`/api/projects/${projectId}/build-install`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(files.length > 0 ? { files } : {}),
                projectName,
                bundleId: finalBundleId,
                developmentTeam: teamId.trim() || undefined,
                autoFix: false,
              }),
            })
              .then((res) => (res.ok ? res.json() : Promise.reject()))
              .then((data: { job?: { id?: string } }) => {
                const id = data?.job?.id;
                if (typeof id === "string") {
                  backgroundInstallJobIdRef.current = id;
                  setBackgroundInstallStatus("building");
                }
              })
              .catch(() => setBackgroundInstallStatus("failed"));
          })();
          const attempt = job?.request?.attempt ?? 1;
          const fNames = Array.isArray(job?.request?.files)
            ? job.request.files.map((f: { path: string }) => f.path)
            : [];
          if (attempt > 1 && Array.isArray(job?.request?.files) && job.request.files.length > 0) {
            return { status: "succeeded", fixedFiles: job.request.files, attempts: attempt, fileNames: fNames };
          }
          return { status: "succeeded", attempts: attempt, fileNames: fNames };
        }
        if (status === "succeeded" && logShowsBuildFailed) {
          const attempt = job?.request?.attempt ?? 1;
          const errors = Array.isArray(job?.compilerErrors) ? job.compilerErrors : [];
          const errorHistory = Array.isArray(job?.errorHistory) ? job.errorHistory : undefined;
          const fNames = Array.isArray(job?.request?.files)
            ? job.request.files.map((f: { path: string }) => f.path)
            : [];
          return {
            status: "failed",
            error: "Build log contains BUILD FAILED.",
            attempts: attempt,
            compilerErrors: errors,
            ...(errorHistory?.length ? { errorHistory } : {}),
            fileNames: fNames,
            sourceFiles: Array.isArray(job?.request?.files) ? job.request.files : undefined,
          };
        }
        if (status === "failed") {
          if (nextJobId) {
            jobId = nextJobId;
            await new Promise((r) => setTimeout(r, VALIDATE_POLL_MS));
            continue;
          }
          if (job?.autoFixInProgress) {
            onProgress?.(formatValidateProgress(job));
            await new Promise((r) => setTimeout(r, VALIDATE_POLL_MS));
            continue;
          }
          const attempt = job?.request?.attempt ?? 1;
          const errors = Array.isArray(job?.compilerErrors) ? job.compilerErrors : [];
          const errorHistory = Array.isArray(job?.errorHistory) ? job.errorHistory : undefined;
          const fNames = Array.isArray(job?.request?.files)
            ? job.request.files.map((f: { path: string }) => f.path)
            : [];
          const err =
            typeof job?.error === "string" && job.error.trim()
              ? job.error.trim()
              : errors.length > 0
                ? String(errors[0]).trim()
                : "Build failed";
          return {
            status: "failed",
            error: err,
            attempts: attempt,
            compilerErrors: errors,
            ...(errorHistory?.length ? { errorHistory } : {}),
            fileNames: fNames,
            sourceFiles: Array.isArray(job?.request?.files) ? job.request.files : undefined,
          };
        }
        await new Promise((r) => setTimeout(r, VALIDATE_POLL_MS));
      }
      return { status: "failed", error: "Validation timed out" };
    },
    []
  );

  // Poll background device build until it succeeds or fails (for "Preparing device build..." label)
  useEffect(() => {
    if (backgroundInstallStatus !== "building" || !backgroundInstallJobIdRef.current) return;
    const jobId = backgroundInstallJobIdRef.current;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/build-jobs/${jobId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        const job = data?.job;
        if (!job || cancelled) return;
        const status = typeof job.status === "string" ? job.status : null;
        const logText = Array.isArray(job?.logs) ? job.logs.join("\n") : "";
        const logShowsBuildFailed = logText.includes("** BUILD FAILED **");
        if (status === "succeeded" && !logShowsBuildFailed) {
          setBackgroundInstallStatus("ready");
          return;
        }
        if (status === "failed" || (status === "succeeded" && logShowsBuildFailed)) {
          setBackgroundInstallStatus("failed");
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        if (!cancelled) setTimeout(poll, 2000);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [backgroundInstallStatus]);

  const clearBackgroundInstallJobId = useCallback(() => {
    backgroundInstallJobIdRef.current = null;
    setBackgroundInstallStatus("idle");
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[var(--background-primary)]">
      {runnerOnline === false && (
        <div
          className="shrink-0 border-b border-amber-500/50 bg-amber-500/15 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200"
          role="status"
        >
          Mac runner offline — builds are currently unavailable. Start the runner or wait for it to come back online.
        </div>
      )}
      <LowCreditBanner />
      {/* Top bar */}
      <header className="grid min-h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b-2 border-[var(--border-default)] px-5 sm:px-6 py-2">
        <div className="flex min-w-0 items-center gap-4">
          <BetaBadge />
          <Link
            href="/dashboard"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--link-default)]"
          >
            Dashboard
          </Link>
          <span
            className="h-6 w-px shrink-0 bg-[var(--text-tertiary)]"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="cursor-pointer truncate text-left text-sm font-medium text-[var(--text-primary)] hover:underline"
          >
            {projectName}
          </button>
        </div>
        <div className="flex justify-center">
          <CreditsWidget />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            className="gap-1.5 text-xs"
            disabled={!canUseSimulator}
            title={canUseSimulator ? "Test your app in the browser simulator" : "Upgrade to access simulator preview"}
            onClick={async () => {
              if (!canUseSimulator) return;
              const data = await refreshSimulatorWallet();
              if ((data.balanceCents ?? 0) <= 0) setSimulatorTopUpOpen(true);
              else setSimulatorConfirmOpen(true);
            }}
          >
            <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Preview in Simulator
          </Button>
          <Button
            variant="secondary"
            className="gap-1.5 text-xs"
            onClick={() => setRunOnDeviceOpen(true)}
            title={runOnDeviceTitle}
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Run on device
          </Button>
          {backgroundInstallStatus === "building" && (
            <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap" aria-live="polite">
              Preparing device build...
            </span>
          )}
          <Button
            variant="secondary"
            className="gap-1.5 text-xs"
            onClick={() => setShareOpen(true)}
            title="Share, distribute, or publish your app"
          >
            <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Share
          </Button>
          <div className="relative">
            <Button
              variant="secondary"
              className="!px-2 text-xs"
              onClick={() => setShortcutsOpen((v) => !v)}
              title="Keyboard shortcuts (⌘/)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="h-4 w-4" aria-hidden />
            </Button>
            {shortcutsOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">Keyboard shortcuts</p>
                <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between"><span>Send message</span><kbd className="rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd></div>
                  <div className="flex items-center justify-between"><span>Run on device</span><kbd className="rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 font-mono text-[10px]">⌘R</kbd></div>
                  <div className="flex items-center justify-between"><span>Share / Export</span><kbd className="rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 font-mono text-[10px]">⌘S</kbd></div>
                  <div className="flex items-center justify-between"><span>Toggle shortcuts</span><kbd className="rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 font-mono text-[10px]">⌘/</kbd></div>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            className="!px-2 text-xs"
            onClick={() => setSettingsOpen(true)}
            title="Project settings — name, bundle ID, install to iPhone"
            aria-label="Project settings"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      {/* Main: chat | resizer | preview */}
      <div className="flex min-h-0 flex-1">
        <aside
          className="flex shrink-0 flex-col border-r border-[var(--border-default)]"
          style={{
            width: chatWidth,
            background: "var(--editor-pane-gradient)",
            transition: isResizing ? "none" : "width 0.2s ease-out",
          }}
        >
          <ChatPanel
            projectId={project.id}
            projectName={projectName}
            buildFailureReason={buildFailureReason}
            onProjectRenamed={(name) => setProjectName(name)}
            onBuildStatusChange={(status) => {
              setBuildStatus(status);
              if (status !== "failed") setBuildFailureReason(null);
            }}
            onIsTypingChange={setIsAgentTyping}
            onOutOfCredits={() => setOutOfCreditsOpen(true)}
            onError={(message) => {
              setToast({ message, variant: "error" });
              setBuildFailureReason(message);
            }}
            onAppBuilt={() => setToast({ message: "App built.", variant: "success" })}
            onProBuildComplete={onProBuildComplete}
          />
        </aside>
        <div
          role="separator"
          aria-label="Resize chat panel. Double-click to reset to default width."
          tabIndex={0}
          onMouseDown={handleResizeStart}
          onDoubleClick={handleResizerDoubleClick}
          className="group flex w-1 shrink-0 cursor-col-resize items-stretch border-0 bg-transparent transition-colors hover:bg-[var(--border-default)]/50 focus:outline-none focus-visible:bg-[var(--border-default)]/50"
          style={{ minWidth: 4 }}
        >
          <span className="w-px shrink-0 bg-[var(--border-default)] transition-colors group-hover:bg-[var(--text-tertiary)]/60 group-focus-visible:bg-[var(--text-tertiary)]/60" aria-hidden />
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PreviewPane
            buildStatus={buildStatus}
            buildFailureReason={buildFailureReason}
            expoUrl={expoUrl}
            onOpenRunOnDevice={() => setRunOnDeviceOpen(true)}
            projectId={project.id}
          />
        </main>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}

      <ProjectSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
        onProjectUpdate={(updates) => {
          if (updates.name) setProjectName(updates.name);
          onProjectSaved?.();
        }}
      />
      <RunOnDeviceModal
        isOpen={runOnDeviceOpen}
        onClose={() => setRunOnDeviceOpen(false)}
        projectId={project.id}
        buildStatus={buildStatus}
        isAgentTyping={isAgentTyping}
        expoUrl={expoUrl}
        onExpoUrl={setExpoUrl}
        backgroundInstallJobIdRef={backgroundInstallJobIdRef}
        onConsumedBackgroundJob={clearBackgroundInstallJobId}
      />
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        projectId={project.id}
      />
      <OutOfCreditsModal
        isOpen={outOfCreditsOpen}
        onClose={() => setOutOfCreditsOpen(false)}
      />

      <SimulatorTopUpModal
        isOpen={simulatorTopUpOpen}
        onClose={() => setSimulatorTopUpOpen(false)}
        onTopUpSuccess={() => refreshSimulatorWallet()}
      />
      <SimulatorConfirmModal
        isOpen={simulatorConfirmOpen}
        onClose={() => setSimulatorConfirmOpen(false)}
        appName={projectName}
        balanceCents={balanceCents}
        onStart={() => {
          setSimulatorSession({
            startTime: Date.now(),
            initialBalanceCents: balanceCents,
            deductedCents: 0,
            liveBalanceCents: balanceCents,
          });
        }}
      />
      {simulatorSession && (
        <SimulatorSessionPill
          sessionStartTime={simulatorSession.startTime}
          initialBalanceCents={simulatorSession.initialBalanceCents}
          balanceCents={simulatorSession.liveBalanceCents}
          onEndSession={async () => {
            if (simulatorDeductIntervalRef.current) {
              clearInterval(simulatorDeductIntervalRef.current);
              simulatorDeductIntervalRef.current = null;
            }
            const elapsedMs = Date.now() - simulatorSession.startTime;
            const elapsedMins = elapsedMs / (60 * 1000);
            const totalCostCents = Math.min(
              Math.floor(elapsedMins * 20),
              simulatorSession.initialBalanceCents
            );
            const alreadyDeducted = simulatorSession.deductedCents;
            const remainingToDeduct = totalCostCents - alreadyDeducted;
            if (remainingToDeduct > 0) {
              try {
                await fetch("/api/simulator-wallet/deduct", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amountCents: remainingToDeduct }),
                  credentials: "include",
                });
              } catch {
                // ignore
              }
            }
            const balanceAfter = simulatorSession.initialBalanceCents - totalCostCents;
            setSimulatorSession(null);
            setSimulatorSummary({
              sessionSeconds: Math.floor(elapsedMs / 1000),
              costCents: totalCostCents,
              balanceAfterCents: balanceAfter,
            });
            refreshSimulatorWallet();
          }}
          lowBalanceWarning={simulatorSession.liveBalanceCents < 100 && simulatorSession.liveBalanceCents > 0}
        />
      )}
      <SimulatorSummaryModal
        isOpen={simulatorSummary !== null}
        onClose={() => setSimulatorSummary(null)}
        sessionSeconds={simulatorSummary?.sessionSeconds ?? 0}
        costCents={simulatorSummary?.costCents ?? 0}
        balanceCentsAfter={simulatorSummary?.balanceAfterCents ?? 0}
      />
      <SimulatorBalanceRanOutModal
        isOpen={simulatorBalanceRanOutOpen}
        onClose={() => setSimulatorBalanceRanOutOpen(false)}
        onTopUp={() => {
          setSimulatorBalanceRanOutOpen(false);
          setSimulatorTopUpOpen(true);
        }}
      />
    </div>
  );
}
