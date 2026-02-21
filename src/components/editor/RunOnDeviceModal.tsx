"use client";

import { useState, useEffect } from "react";
import { Modal, Button, QRCode, Input } from "@/components/ui";

const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";
const PROJECT_FILES_STORAGE_PREFIX = "vibetree-project-files:";
const XCODE_TEAM_ID_STORAGE_PREFIX = "vibetree-xcode-team-id:";
const XCODE_BUNDLE_ID_OVERRIDE_PREFIX = "vibetree-xcode-bundle-id:";

export function RunOnDeviceModal({
  isOpen,
  onClose,
  projectId,
  expoUrl: expoUrlProp,
  onExpoUrl,
  projectType: projectTypeProp,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  expoUrl?: string | null;
  /** When we get a URL from the API, pass it to the parent so the preview pane can show the QR too. */
  onExpoUrl?: (url: string) => void;
  /** "pro" = native Swift: show download CTA. From localStorage or parent. */
  projectType?: "standard" | "pro";
}) {
  const [expoUrlLocal, setExpoUrlLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [bundleIdOverride, setBundleIdOverride] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const projectType =
    projectTypeProp ??
    (typeof window !== "undefined" && (localStorage.getItem(PROJECT_TYPE_STORAGE_KEY) === "pro" ? "pro" : "standard"));

  const expoUrl = expoUrlProp ?? expoUrlLocal;

  useEffect(() => {
    if (!isOpen || !projectId) return;
    if (typeof window !== "undefined") {
      try {
        const t = localStorage.getItem(`${XCODE_TEAM_ID_STORAGE_PREFIX}${projectId}`) ?? "";
        const b = localStorage.getItem(`${XCODE_BUNDLE_ID_OVERRIDE_PREFIX}${projectId}`) ?? "";
        setTeamId(t);
        setBundleIdOverride(b);
      } catch {
        // ignore
      }
    }
    if (projectType === "pro") {
      setError(null);
      setLoading(false);
      return;
    }
    if (expoUrlProp != null) {
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/projects/${projectId}/run-on-device?projectType=standard`)
      .then((res) => res.json())
      .then((data) => {
        if (data.expoUrl) {
          setExpoUrlLocal(data.expoUrl);
          onExpoUrl?.(data.expoUrl);
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch(() => setError("Could not start preview. Try again."))
      .finally(() => setLoading(false));
  }, [isOpen, projectId, projectType, expoUrlProp, onExpoUrl]);

  async function handleDownloadForXcode() {
    setDownloadLoading(true);
    setError(null);
    try {
      let res: Response | null = null;
      const getFilenameFromHeaders = (r: Response): string | null => {
        const cd = r.headers.get("Content-Disposition") || r.headers.get("content-disposition");
        if (!cd) return null;
        const m = cd.match(/filename=\"([^\"]+)\"/);
        return m?.[1] ?? null;
      };

      // Prefer exporting from client-cached Swift files (survives refresh/dev reload).
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(`${PROJECT_FILES_STORAGE_PREFIX}${projectId}`);
          const parsed = raw ? JSON.parse(raw) : null;
          const files = Array.isArray(parsed?.files) ? parsed.files : [];
          if (files.length > 0) {
            // Best-effort: include project name + bundle id for a nicer Xcode project name.
            let projectName = "Untitled app";
            let bundleId = "";
            try {
              const projectsRaw = localStorage.getItem("vibetree-projects");
              const projects = projectsRaw ? JSON.parse(projectsRaw) : [];
              const p = Array.isArray(projects) ? projects.find((x: any) => x?.id === projectId) : null;
              if (p?.name) projectName = String(p.name);
              if (p?.bundleId) bundleId = String(p.bundleId);
            } catch {}

            const finalBundleId = bundleIdOverride.trim() || bundleId;
            const finalTeamId = teamId.trim();

            res = await fetch(`/api/projects/${projectId}/export-xcode`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                files,
                projectName,
                bundleId: finalBundleId,
                developmentTeam: finalTeamId,
              }),
            });
          }
        } catch {
          // ignore and fall back to server cache
        }
      }

      // Fallback: server-side in-memory cache
      if (!res) {
        res = await fetch(`/api/projects/${projectId}/export-xcode`);
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getFilenameFromHeaders(res) ?? `VibetreeApp-${projectId.slice(0, 12)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed. Try again.");
    } finally {
      setDownloadLoading(false);
    }
  }

  async function handleDownloadSource() {
    setDownloadLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/export?projectType=pro`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vibetree-${projectId.slice(0, 20)}.swift`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Try again.");
    } finally {
      setDownloadLoading(false);
    }
  }

  if (projectType === "pro") {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Run on your iPhone (Pro)">
        <div className="space-y-4">
          {error && (
            <div className="rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2">
              <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-body-muted text-sm">
              Pro apps are native Swift/SwiftUI. Download for Xcode (zip), unzip, double‑click the project, then Run on your iPhone or simulator.
            </p>
            <div className="rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2">
              <p className="text-caption text-xs text-[var(--text-tertiary)]">
                After opening in Xcode: <span className="text-[var(--text-secondary)]">Target → Signing &amp; Capabilities</span> → select your{" "}
                <span className="text-[var(--text-secondary)]">Team</span>. (Automatic signing is enabled by default.)
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            <Button
              type="button"
              onClick={handleDownloadForXcode}
              disabled={downloadLoading}
              className="w-full"
            >
              {downloadLoading ? "Preparing…" : "Download for Xcode (.zip)"}
            </Button>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-body-muted text-xs font-medium hover:text-[var(--link-default)] hover:underline"
            >
              {showAdvanced ? "Hide Advanced" : "Advanced (optional): set Team ID / Bundle ID"}
            </button>
            {showAdvanced && (
              <div className="space-y-3 rounded border border-[var(--border-default)] bg-[var(--background-default)] p-3">
                <div>
                  <label htmlFor="xcode-team-id" className="text-body-muted mb-1.5 block text-sm">
                    Team ID
                  </label>
                  <Input
                    id="xcode-team-id"
                    value={teamId}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      setTeamId(v);
                      try {
                        localStorage.setItem(`${XCODE_TEAM_ID_STORAGE_PREFIX}${projectId}`, v);
                      } catch {}
                    }}
                    placeholder="ABCDE12345"
                    inputMode="text"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    If provided, we’ll embed it into the exported project (avoids the “Pick a Team” prompt on first open).
                  </p>
                </div>
                <div>
                  <label htmlFor="xcode-bundle-id" className="text-body-muted mb-1.5 block text-sm">
                    Bundle ID (override)
                  </label>
                  <Input
                    id="xcode-bundle-id"
                    value={bundleIdOverride}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setBundleIdOverride(v);
                      try {
                        localStorage.setItem(`${XCODE_BUNDLE_ID_OVERRIDE_PREFIX}${projectId}`, v);
                      } catch {}
                    }}
                    placeholder="com.yourcompany.appname"
                    inputMode="text"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Leave blank to use the project’s bundle ID from settings.
                  </p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleDownloadSource}
              disabled={downloadLoading}
              className="text-body-muted text-xs font-medium hover:text-[var(--link-default)] hover:underline disabled:opacity-50"
            >
              Or download single .swift file
            </button>
            <p className="text-caption text-xs text-[var(--text-tertiary)]">
              Unzip → double‑click the .xcodeproj → connect iPhone → Run. No Expo Go needed.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Preview on your iPhone">
      <div className="space-y-4">
        <p className="text-body-muted text-sm">
          Scan the QR code with your iPhone camera or from inside the Expo Go app. Your app will load with no install step—no Apple Developer account needed.
        </p>
        {loading ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded border border-[var(--border-default)] bg-[var(--background-secondary)]">
            <span className="text-sm text-[var(--text-tertiary)]">Starting Expo server…</span>
            <span className="text-xs text-[var(--text-tertiary)]">This may take 1–2 minutes the first time.</span>
          </div>
        ) : error ? (
          <div className="rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">Build your app in the chat first (e.g. &quot;A simple counter app&quot;), then try again.</p>
          </div>
        ) : expoUrl ? (
          <div className="flex flex-col items-start gap-2">
            <QRCode value={expoUrl} size={200} className="rounded border border-[var(--border-default)] bg-white p-2" />
            <p className="text-caption text-xs text-[var(--text-tertiary)]">Open the Expo Go app, then scan this QR code.</p>
            <p className="text-caption text-xs text-[var(--text-tertiary)]">Or use the QR code in the preview pane to the right.</p>
          </div>
        ) : (
          <p className="text-caption text-xs text-[var(--text-tertiary)]">Build your app first, then the QR code will appear here.</p>
        )}
      </div>
    </Modal>
  );
}
