"use client";

import { useState, useEffect } from "react";
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

export function EditorLayout({ project }: { project: Project }) {
  const [projectName, setProjectName] = useState(project.name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runOnDeviceOpen, setRunOnDeviceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "live" | "failed">("idle");
  const [expoUrl, setExpoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "warning" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (!project.id) return;
    fetch(`/api/projects/${project.id}/run-on-device`)
      .then((res) => res.json())
      .then((data) => { if (data.expoUrl) setExpoUrl(data.expoUrl); })
      .catch(() => {});
  }, [project.id]);

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

      {/* Main: chat | preview | optional sidebar */}
      <div className="flex min-h-0 flex-1">
        <aside
          className="flex w-[380px] shrink-0 flex-col border-r border-[var(--border-default)] md:w-[420px]"
          style={{ background: "var(--editor-pane-gradient)" }}
        >
          <ChatPanel
            projectId={project.id}
            projectName={projectName}
            onBuildStatusChange={setBuildStatus}
            onOutOfCredits={() => setToast({ message: "You're out of credits. Buy more to continue.", variant: "warning" })}
            onError={(message) => setToast({ message, variant: "error" })}
          />
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PreviewPane
            buildStatus={buildStatus}
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
      />
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        projectId={project.id}
      />
      <PublishModal isOpen={publishOpen} onClose={() => setPublishOpen(false)} />
    </div>
  );
}
