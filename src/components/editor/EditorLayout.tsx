"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Smartphone, Share2, Upload } from "lucide-react";
import { Button, BetaBadge, Toast } from "@/components/ui";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { LowCreditBanner } from "@/components/credits/LowCreditBanner";
import type { Project } from "@/lib/projects";
import { ChatPanel } from "./ChatPanel";
import { PreviewPane } from "./PreviewPane";
import { ProjectSettingsModal } from "./ProjectSettingsModal";
import { RunOnDeviceModal } from "./RunOnDeviceModal";
import { ShareModal } from "./ShareModal";
import { PublishModal } from "./PublishModal";
import { OutOfCreditsModal } from "./OutOfCreditsModal";

const CHAT_WIDTH_KEY = "vibetree-editor-chat-width";
const CHAT_WIDTH_MIN = 300;
const CHAT_WIDTH_MAX = 560;
const CHAT_WIDTH_DEFAULT = 420;

const PROJECT_FILES_PREFIX = "vibetree-project-files:";
const XCODE_TEAM_ID_PREFIX = "vibetree-xcode-team-id:";
const XCODE_BUNDLE_ID_OVERRIDE_PREFIX = "vibetree-xcode-bundle-id:";
const VALIDATE_POLL_MS = 2000;
const VALIDATE_TIMEOUT_MS = 10 * 60 * 1000;

function formatValidateProgress(job: { status?: string; startedAt?: number; createdAt?: number; request?: { attempt?: number; maxAttempts?: number } }): string {
  const status = job?.status ?? "queued";
  const elapsed = Math.floor((Date.now() - (job?.startedAt ?? job?.createdAt ?? Date.now())) / 1000);
  const attempt = job?.request?.attempt ?? 1;
  const maxAttempts = job?.request?.maxAttempts ?? 3;
  const prefix = "Validating build on Mac…";
  if (attempt > 1 && (status === "queued" || status === "running")) {
    return `${prefix} Auto-fixing Swift errors… (${elapsed}s) · Attempt ${attempt}/${maxAttempts}`;
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

export function EditorLayout({ project }: { project: Project }) {
  const [projectName, setProjectName] = useState(project.name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runOnDeviceOpen, setRunOnDeviceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "live" | "failed">("idle");
  const [buildFailureReason, setBuildFailureReason] = useState<string | null>(null);
  const [expoUrl, setExpoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "warning" | "error" | "info" } | null>(null);
  const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setChatWidth(getStoredChatWidth());
  }, []);

  useEffect(() => {
    if (!project.id) return;
    const isPro =
      typeof window !== "undefined" && localStorage.getItem("vibetree-project-type") === "pro";
    if (isPro) return;
    fetch(`/api/projects/${project.id}/run-on-device?projectType=standard`)
      .then((res) => res.json())
      .then((data) => { if (data.expoUrl) setExpoUrl(data.expoUrl); })
      .catch(() => {});
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
    ): Promise<{ status: "succeeded" | "failed"; error?: string }> => {
      if (typeof window === "undefined") return { status: "failed", error: "Not in browser" };
      let files: Array<{ path: string; content: string }> = [];
      let projectName = "Untitled app";
      let bundleId = "";
      let teamId = "";
      let bundleIdOverride = "";
      try {
        const raw = localStorage.getItem(`${PROJECT_FILES_PREFIX}${projectId}`);
        const parsed = raw ? JSON.parse(raw) : null;
        files = Array.isArray(parsed?.files) ? parsed.files : [];
        const projectsRaw = localStorage.getItem("vibetree-projects");
        const projects = projectsRaw ? JSON.parse(projectsRaw) : [];
        const p = Array.isArray(projects) ? projects.find((x: { id?: string }) => x?.id === projectId) : null;
        if (p?.name) projectName = String(p.name);
        if (p?.bundleId) bundleId = String(p.bundleId);
        teamId = localStorage.getItem(`${XCODE_TEAM_ID_PREFIX}${projectId}`) ?? "";
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
        return { status: "failed", error: data?.error ?? "Validation request failed" };
      }
      const data = await res.json().catch(() => ({}));
      let jobId: string | null = typeof data?.job?.id === "string" ? data.job.id : null;
      if (!jobId) return { status: "failed", error: "No job id returned" };
      const deadline = Date.now() + VALIDATE_TIMEOUT_MS;
      onProgress?.("Validating build on Mac… Waiting for runner… (0s)");
      while (Date.now() < deadline) {
        const jobRes = await fetch(`/api/build-jobs/${jobId}`);
        if (!jobRes.ok) break;
        const jobData = await jobRes.json().catch(() => ({}));
        const job = jobData?.job;
        const status = typeof job?.status === "string" ? job.status : null;
        const nextJobId = typeof job?.nextJobId === "string" ? job.nextJobId : null;
        onProgress?.(formatValidateProgress(job ?? {}));
        if (status === "succeeded") return { status: "succeeded" };
        if (status === "failed") {
          if (nextJobId) {
            jobId = nextJobId;
            await new Promise((r) => setTimeout(r, VALIDATE_POLL_MS));
            continue;
          }
          const err =
            typeof job?.error === "string" && job.error.trim()
              ? job.error.trim()
              : Array.isArray(job?.compilerErrors) && job.compilerErrors.length > 0
                ? String(job.compilerErrors[0]).trim()
                : "Build failed";
          return { status: "failed", error: err };
        }
        await new Promise((r) => setTimeout(r, VALIDATE_POLL_MS));
      }
      return { status: "failed", error: "Validation timed out" };
    },
    []
  );

  return (
    <div className="flex h-screen flex-col bg-[var(--background-primary)]">
      <LowCreditBanner />
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-[var(--border-default)] px-5 sm:px-6">
        <div className="flex items-center gap-4">
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
            className="text-left text-sm font-medium text-[var(--text-primary)] hover:underline"
          >
            {projectName}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <CreditsWidget />
          <Button
            variant="secondary"
            className="gap-1.5 text-xs"
            onClick={() => setRunOnDeviceOpen(true)}
            title="Preview on your iPhone with Expo Go"
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Run on device
          </Button>
          <Button
            variant="secondary"
            className="gap-1.5 text-xs"
            onClick={() => setShareOpen(true)}
            title="Get TestFlight link, invite testers, or install via desktop agent"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share
          </Button>
          <Button
            variant="secondary"
            className="gap-1.5 text-xs"
            onClick={() => setPublishOpen(true)}
            title="Sign in with Apple to publish"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Publish
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
            onBuildStatusChange={(status) => {
              setBuildStatus(status);
              if (status !== "failed") setBuildFailureReason(null);
            }}
            onOutOfCredits={() => setOutOfCreditsOpen(true)}
            onError={(message) => {
              setToast({ message, variant: "error" });
              setBuildFailureReason(message);
            }}
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
        }}
      />
      <RunOnDeviceModal
        isOpen={runOnDeviceOpen}
        onClose={() => setRunOnDeviceOpen(false)}
        projectId={project.id}
        expoUrl={expoUrl}
        onExpoUrl={setExpoUrl}
      />
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        projectId={project.id}
      />
      <PublishModal isOpen={publishOpen} onClose={() => setPublishOpen(false)} />
      <OutOfCreditsModal
        isOpen={outOfCreditsOpen}
        onClose={() => setOutOfCreditsOpen(false)}
      />
    </div>
  );
}
