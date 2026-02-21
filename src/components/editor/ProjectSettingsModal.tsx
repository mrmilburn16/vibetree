"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input } from "@/components/ui";
import { updateProject, type Project } from "@/lib/projects";

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function ProjectSettingsModal({
  isOpen,
  onClose,
  project,
  onProjectUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdate: (updates: { name?: string; bundleId?: string }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [bundleId, setBundleId] = useState(project.bundleId);
  const [nameError, setNameError] = useState("");
  const [bundleError, setBundleError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setBundleId(project.bundleId);
      setNameError("");
      setBundleError("");
    }
  }, [isOpen, project.name, project.bundleId]);

  const isValidBundleId = (value: string) =>
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);

  function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    let valid = true;
    if (!name.trim()) {
      setNameError("Project name is required.");
      valid = false;
    } else {
      setNameError("");
    }
    if (!isValidBundleId(bundleId.trim())) {
      setBundleError("Use a valid bundle ID (e.g. com.yourcompany.appname).");
      valid = false;
    } else {
      setBundleError("");
    }
    if (!valid) return;

    updateProject(project.id, { name: name.trim(), bundleId: bundleId.trim() });
    onProjectUpdate({ name: name.trim(), bundleId: bundleId.trim() });
    onClose();
  }

  async function handleDownloadSource() {
    setExportLoading(true);
    try {
      const pt =
        typeof window !== "undefined" && localStorage.getItem("vibetree-project-type") === "pro"
          ? "pro"
          : "standard";
      const res = await fetch(`/api/projects/${project.id}/export?projectType=${pt}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vibetree-${project.id.slice(0, 20)}.swift`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail or toast in future
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Project settings"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="project-settings-form" variant="primary">
            Save
          </Button>
        </>
      }
    >
      <form
        id="project-settings-form"
        onSubmit={handleSave}
        className="space-y-4"
      >
        <div>
          <label htmlFor="project-name" className="text-body-muted mb-1.5 block text-sm">
            Project name
          </label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My app"
          />
          {nameError && (
            <p className="mt-1 text-sm text-[var(--semantic-error)]">{nameError}</p>
          )}
        </div>
        <div>
          <label htmlFor="bundle-id" className="text-body-muted mb-1.5 block text-sm">
            Bundle identifier
          </label>
          <Input
            id="bundle-id"
            value={bundleId}
            onChange={(e) => setBundleId(e.target.value)}
            placeholder="com.yourcompany.appname"
          />
          {bundleError && (
            <p className="mt-1 text-sm text-[var(--semantic-error)]">{bundleError}</p>
          )}
        </div>
        <div>
          <span className="text-body-muted text-sm">App icon</span>
          <p className="text-caption mt-1">Generate with AI (coming soon) or upload an image.</p>
        </div>
        <div className="border-t border-[var(--border-default)] pt-4">
          <span className="text-body-muted text-sm">Export</span>
          <p className="text-caption mt-1 mb-2">Download your project&apos;s source code as a Swift file. Builds trust and lets you open the project in Xcode.</p>
          <Button type="button" variant="secondary" onClick={handleDownloadSource} disabled={exportLoading} className="gap-2">
            <DownloadIcon />
            {exportLoading ? "Preparing…" : "Download source"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
