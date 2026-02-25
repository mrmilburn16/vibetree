"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Modal, Button, QRCode, Input } from "@/components/ui";

const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";
const PROJECT_FILES_STORAGE_PREFIX = "vibetree-project-files:";
const XCODE_TEAM_ID_STORAGE_PREFIX = "vibetree-xcode-team-id:";
const XCODE_BUNDLE_ID_OVERRIDE_PREFIX = "vibetree-xcode-bundle-id:";
const XCODE_PREFERRED_DEVICE_PREFIX = "vibetree-xcode-preferred-device:";

type PreflightResult = {
  runner: { ok: boolean; runnerId?: string };
  device: { ok: boolean; name?: string; id?: string };
  teamId: { ok: boolean; value?: string };
  files: { ok: boolean; count?: number };
};

function usePreflightChecks(
  projectId: string,
  teamId: string,
  isOpen: boolean,
  buildStatus?: "idle" | "building" | "live" | "failed"
) {
  const [checks, setChecks] = useState<PreflightResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("projectId", projectId);
      if (teamId.trim()) q.set("teamId", teamId.trim());
      const res = await fetch(`/api/macos/preflight?${q.toString()}`);
      if (res.ok) {
        const data: PreflightResult = await res.json();
        setChecks(data);
      }
    } catch {
      // keep previous checks on error
    } finally {
      setLoading(false);
    }
  }, [projectId, teamId]);

  const prevBuildStatus = useRef<typeof buildStatus>(undefined);
  useEffect(() => {
    if (isOpen) run();
  }, [isOpen, run]);

  // Re-run preflight when build just became "live" so Project files check updates
  useEffect(() => {
    const justBecameLive =
      buildStatus === "live" && prevBuildStatus.current !== "live";
    prevBuildStatus.current = buildStatus;
    if (isOpen && justBecameLive) run();
  }, [buildStatus, isOpen, run]);

  const allPassed =
    checks != null &&
    checks.runner.ok &&
    checks.device.ok &&
    checks.teamId.ok &&
    checks.files.ok;

  return { checks, allPassed, loading, recheck: run };
}

export function RunOnDeviceModal({
  isOpen,
  onClose,
  projectId,
  buildStatus,
  expoUrl: expoUrlProp,
  onExpoUrl,
  projectType: projectTypeProp,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  /** When this becomes "live", preflight re-runs so Project files check updates. */
  buildStatus?: "idle" | "building" | "live" | "failed";
  expoUrl?: string | null;
  onExpoUrl?: (url: string) => void;
  projectType?: "standard" | "pro";
}) {
  const [expoUrlLocal, setExpoUrlLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [preferredRunDevice, setPreferredRunDevice] = useState("");
  const [bundleIdOverride, setBundleIdOverride] = useState("");
  const [errorCopyFeedback, setErrorCopyFeedback] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [installJobId, setInstallJobId] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [installLogTail, setInstallLogTail] = useState<string[]>([]);
  const [installElapsed, setInstallElapsed] = useState(0);
  const [installStartedAt, setInstallStartedAt] = useState<number | null>(
    null
  );
  const [showTeamIdInput, setShowTeamIdInput] = useState(false);

  const projectType =
    projectTypeProp ??
    (typeof window !== "undefined" &&
    localStorage.getItem(PROJECT_TYPE_STORAGE_KEY) === "pro"
      ? "pro"
      : "standard");

  const expoUrl = expoUrlProp ?? expoUrlLocal;

  const { checks, allPassed, loading: preflightLoading, recheck } =
    usePreflightChecks(projectId, teamId, isOpen && projectType === "pro", buildStatus);

  // Load saved settings from localStorage on open
  useEffect(() => {
    if (!isOpen || !projectId) return;
    if (typeof window !== "undefined") {
      try {
        let t =
          localStorage.getItem(
            `${XCODE_TEAM_ID_STORAGE_PREFIX}${projectId}`
          ) ?? "";
        if (!t) {
          const universal = localStorage.getItem("vibetree-universal-defaults");
          if (universal) {
            try {
              const parsed = JSON.parse(universal);
              if (typeof parsed.teamId === "string") t = parsed.teamId;
            } catch {}
          }
        }
        let d =
          localStorage.getItem(
            `${XCODE_PREFERRED_DEVICE_PREFIX}${projectId}`
          ) ?? "";
        if (!d) {
          const universal = localStorage.getItem("vibetree-universal-defaults");
          if (universal) {
            try {
              const parsed = JSON.parse(universal);
              if (typeof parsed.preferredRunDevice === "string")
                d = parsed.preferredRunDevice;
            } catch {}
          }
        }
        const b =
          localStorage.getItem(
            `${XCODE_BUNDLE_ID_OVERRIDE_PREFIX}${projectId}`
          ) ?? "";
        setTeamId(t);
        setPreferredRunDevice(d);
        setBundleIdOverride(b);
      } catch {}
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
    (async () => {
      try {
        let res = await fetch(
          `/api/projects/${projectId}/run-on-device?projectType=standard`
        );
        let data = await res.json().catch(() => ({}));
        if (data.expoUrl) {
          setExpoUrlLocal(data.expoUrl);
          onExpoUrl?.(data.expoUrl);
          return;
        }
        const noFiles =
          res.status === 400 &&
          (data.code === "NO_FILES" || data.code === "NO_APP");
        if (noFiles && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(
              `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`
            );
            const parsed = raw ? JSON.parse(raw) : null;
            const files = Array.isArray(parsed?.files) ? parsed.files : [];
            if (files.length > 0) {
              res = await fetch(
                `/api/projects/${projectId}/run-on-device?projectType=standard`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ files }),
                }
              );
              data = await res.json().catch(() => ({}));
              if (data.expoUrl) {
                setExpoUrlLocal(data.expoUrl);
                onExpoUrl?.(data.expoUrl);
                return;
              }
            }
          } catch {}
        }
        if (data.error) setError(data.error);
      } catch {
        setError("Could not start preview. Try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, projectId, projectType, expoUrlProp, onExpoUrl]);

  // Poll install job status
  useEffect(() => {
    if (!isOpen || !installJobId) return;
    let cancelled = false;
    let currentJobId = installJobId;

    const poll = async () => {
      try {
        const res = await fetch(`/api/build-jobs/${currentJobId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        const job = data?.job;
        if (!job || cancelled) return;

        const status = typeof job.status === "string" ? job.status : null;
        const nextJobId =
          typeof job.nextJobId === "string" ? job.nextJobId : null;
        const logs = Array.isArray(job.logs)
          ? job.logs.filter((x: unknown) => typeof x === "string")
          : [];
        setInstallLogTail(logs.slice(-10));

        if (status === "failed" && nextJobId) {
          currentJobId = nextJobId;
          setInstallJobId(nextJobId);
          setTimeout(poll, 2000);
          return;
        }

        setInstallStatus(status);
        if (status === "succeeded" || status === "failed") return;
        setTimeout(poll, 2000);
      } catch {
        // ignore
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [isOpen, installJobId]);

  // Install elapsed timer
  useEffect(() => {
    if (!installStartedAt || !installStatus) return;
    if (installStatus === "succeeded" || installStatus === "failed") return;
    const iv = setInterval(() => {
      setInstallElapsed(Math.floor((Date.now() - installStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [installStartedAt, installStatus]);

  async function handleInstallOnDevice() {
    setInstallLoading(true);
    setError(null);
    setInstallStatus("queued");
    setInstallLogTail([]);
    setInstallStartedAt(Date.now());
    setInstallElapsed(0);
    try {
      let files: { path: string; content: string }[] = [];
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(
            `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`
          );
          const parsed = raw ? JSON.parse(raw) : null;
          files = Array.isArray(parsed?.files) ? parsed.files : [];
        } catch {}
      }

      let projectName = "Untitled app";
      let bundleId = "";
      if (typeof window !== "undefined") {
        try {
          const projectsRaw = localStorage.getItem("vibetree-projects");
          const projects = projectsRaw ? JSON.parse(projectsRaw) : [];
          const p = Array.isArray(projects)
            ? projects.find((x: { id?: string }) => x?.id === projectId)
            : null;
          if (p?.name) projectName = String(p.name);
          if (p?.bundleId) bundleId = String(p.bundleId);
        } catch {}
      }

      const finalBundleId = bundleIdOverride.trim() || bundleId;
      const finalTeamId = teamId.trim();

      const res = await fetch(`/api/projects/${projectId}/build-install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.length > 0 ? files : undefined,
          projectName,
          bundleId: finalBundleId,
          developmentTeam: finalTeamId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Install request failed");
      }
      const data = await res.json().catch(() => ({}));
      const jobId = typeof data?.job?.id === "string" ? data.job.id : null;
      if (!jobId) throw new Error("No job id returned");
      setInstallJobId(jobId);
      setInstallStatus("queued");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Install failed. Try again.");
      setInstallStatus("failed");
    } finally {
      setInstallLoading(false);
    }
  }

  async function handleDownloadForXcode() {
    setDownloadLoading(true);
    setError(null);
    try {
      let res: Response | null = null;
      const getFilenameFromHeaders = (r: Response): string | null => {
        const cd =
          r.headers.get("Content-Disposition") ||
          r.headers.get("content-disposition");
        if (!cd) return null;
        const m = cd.match(/filename=\"([^\"]+)\"/);
        return m?.[1] ?? null;
      };

      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(
            `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`
          );
          const parsed = raw ? JSON.parse(raw) : null;
          const files = Array.isArray(parsed?.files) ? parsed.files : [];
          if (files.length > 0) {
            let projectName = "Untitled app";
            let bundleId = "";
            try {
              const projectsRaw = localStorage.getItem("vibetree-projects");
              const projects = projectsRaw ? JSON.parse(projectsRaw) : [];
              const p = Array.isArray(projects)
                ? projects.find((x: { id?: string }) => x?.id === projectId)
                : null;
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
                preferredRunDevice: preferredRunDevice.trim() || undefined,
                timezoneOffsetMinutes: new Date().getTimezoneOffset(),
              }),
            });
          }
        } catch {}
      }

      if (!res) {
        const q = new URLSearchParams();
        if (teamId.trim()) q.set("developmentTeam", teamId.trim());
        if (preferredRunDevice.trim())
          q.set("preferredRunDevice", preferredRunDevice.trim());
        q.set(
          "timezoneOffsetMinutes",
          String(new Date().getTimezoneOffset())
        );
        res = await fetch(
          `/api/projects/${projectId}/export-xcode?${q.toString()}`
        );
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        getFilenameFromHeaders(res) ??
        `VibetreeApp-${projectId.slice(0, 12)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Download failed. Try again."
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  // ───────── Preflight check row ─────────
  function CheckRow({
    ok,
    loading: rowLoading,
    label,
    detail,
    action,
  }: {
    ok: boolean | null;
    loading: boolean;
    label: string;
    detail?: string;
    action?: React.ReactNode;
  }) {
    return (
      <div className="flex items-start gap-2.5 py-1.5">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
          {rowLoading || ok === null ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--primary-default)]" />
          ) : ok ? (
            <span className="text-sm text-green-400">&#10003;</span>
          ) : (
            <span className="text-sm text-red-400">&#10007;</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-sm text-[var(--text-default)]">{label}</span>
          {detail && (
            <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">
              {detail}
            </span>
          )}
          {action && <div className="mt-1.5">{action}</div>}
        </div>
      </div>
    );
  }

  // ───────── Pro mode ─────────
  if (projectType === "pro") {
    const isBuilding =
      installStatus === "queued" || installStatus === "running";
    const isDone =
      installStatus === "succeeded" || installStatus === "failed";

    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Run on your iPhone">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Build and install your app directly to your iPhone.
          </p>

          {error && (
            <div className="rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* ── Preflight checklist ── */}
          <div className="rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                Preflight
              </span>
              {checks && !preflightLoading && (
                <button
                  type="button"
                  onClick={recheck}
                  className="cursor-pointer text-xs text-[var(--link-default)] hover:underline"
                >
                  Re-check
                </button>
              )}
            </div>

            <CheckRow
              ok={checks?.runner.ok ?? null}
              loading={preflightLoading && !checks}
              label="Mac runner"
              detail={
                checks?.runner.ok
                  ? "Connected"
                  : checks && !checks.runner.ok
                    ? "Not running \u2014 start npm run mac-runner"
                    : undefined
              }
            />
            <CheckRow
              ok={checks?.device.ok ?? null}
              loading={preflightLoading && !checks}
              label="iPhone connected"
              detail={
                checks?.device.ok
                  ? checks.device.name ?? "Detected"
                  : checks && !checks.device.ok
                    ? "Connect via USB or same WiFi"
                    : undefined
              }
            />
            <CheckRow
              ok={checks?.teamId.ok ?? null}
              loading={preflightLoading && !checks}
              label="Team ID"
              detail={
                checks?.teamId.ok
                  ? checks.teamId.value
                  : checks && !checks.teamId.ok
                    ? "Required for code signing"
                    : undefined
              }
              action={
                checks && !checks.teamId.ok ? (
                  showTeamIdInput ? (
                    <div className="flex items-center gap-2">
                      <Input
                        id="preflight-team-id"
                        value={teamId}
                        onChange={(e) => {
                          const v = e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "");
                          setTeamId(v);
                          try {
                            localStorage.setItem(
                              `${XCODE_TEAM_ID_STORAGE_PREFIX}${projectId}`,
                              v
                            );
                          } catch {}
                        }}
                        placeholder="ABCDE12345"
                        className="w-32 font-mono text-xs"
                        inputMode="text"
                        autoCapitalize="characters"
                        spellCheck={false}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={recheck}
                        className="cursor-pointer whitespace-nowrap rounded bg-[var(--primary-default)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTeamIdInput(true)}
                      className="cursor-pointer text-xs text-[var(--link-default)] hover:underline"
                    >
                      Set Team ID
                    </button>
                  )
                ) : undefined
              }
            />
            <CheckRow
              ok={checks?.files.ok ?? null}
              loading={preflightLoading && !checks}
              label="Project files"
              detail={
                checks?.files.ok
                  ? `${checks.files.count} Swift file${(checks.files.count ?? 0) !== 1 ? "s" : ""}`
                  : checks && !checks.files.ok
                    ? "Build your app in the editor first"
                    : undefined
              }
            />
          </div>
          {checks && !checks.files.ok && (
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Each prompt creates a new project. Make sure you’re in the project you just built, then click Re-check above.
            </p>
          )}

          {/* ── Install button ── */}
          <Button
            type="button"
            onClick={handleInstallOnDevice}
            disabled={
              !allPassed || installLoading || isBuilding
            }
            className="w-full"
          >
            {installLoading
              ? "Starting\u2026"
              : isBuilding
                ? `Building & installing\u2026 (${installElapsed}s)`
                : installStatus === "succeeded"
                  ? "Re-install on iPhone"
                  : "Install on iPhone"}
          </Button>

          {/* ── Build progress ── */}
          {installStatus && (
            <div className="rounded border border-[var(--border-default)] bg-[var(--background-default)] p-3">
              <div className="flex items-center gap-2">
                {isBuilding && (
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--primary-default)]" />
                )}
                {installStatus === "succeeded" && (
                  <span className="text-green-400">&#10003;</span>
                )}
                {installStatus === "failed" && (
                  <span className="text-red-400">&#10007;</span>
                )}
                <span
                  className={
                    installStatus === "succeeded"
                      ? "text-sm font-medium text-[var(--text-default)]"
                      : installStatus === "failed"
                        ? "text-sm text-red-400"
                        : "text-xs text-[var(--text-tertiary)]"
                  }
                >
                  {installStatus === "queued" &&
                    "Waiting for Mac runner to start build\u2026"}
                  {installStatus === "running" &&
                    "Building for device & installing\u2026"}
                  {installStatus === "succeeded" &&
                    "Your app is installed! Check your iPhone."}
                  {installStatus === "failed" &&
                    "Install failed \u2014 try downloading for Xcode instead."}
                </span>
              </div>
              {installLogTail.length > 0 && (
                <pre className="mt-2 max-h-[120px] overflow-auto rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {installLogTail.join("\n")}
                </pre>
              )}
            </div>
          )}

          {/* ── Fallback download link ── */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={handleDownloadForXcode}
              disabled={downloadLoading}
              className="cursor-pointer text-xs text-[var(--text-tertiary)] hover:text-[var(--link-default)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadLoading
                ? "Preparing download\u2026"
                : "Or download Xcode project (.zip)"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ───────── Standard (Expo) mode ─────────
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Preview on your iPhone">
      <div className="space-y-4">
        <p className="text-body-muted text-sm">
          Scan the QR code with your iPhone camera or from inside the Expo Go
          app. Your app will load with no install step—no Apple Developer
          account needed.
        </p>
        {loading ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded border border-[var(--border-default)] bg-[var(--background-secondary)]">
            <span className="text-sm text-[var(--text-tertiary)]">
              Starting Expo server\u2026
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              This may take 1\u20132 minutes the first time.
            </span>
          </div>
        ) : error ? (
          <div className="rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm text-[var(--text-secondary)]">
                {error}
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(error);
                    setErrorCopyFeedback(true);
                    setTimeout(() => setErrorCopyFeedback(false), 2000);
                  } catch {}
                }}
                className="shrink-0 cursor-pointer rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              >
                {errorCopyFeedback ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              {error.includes("Build your app") ||
              error.includes("Generated app must include")
                ? 'Describe an app in the chat (e.g. "A simple counter app"), wait for it to build, then try again.'
                : "If you haven't built an app yet, describe one in the chat first. Otherwise the Expo server may have failed\u2014check the terminal where the dev server is running for details."}
            </p>
          </div>
        ) : expoUrl ? (
          <div className="flex flex-col items-start gap-2">
            <QRCode
              value={expoUrl}
              size={200}
              className="rounded border border-[var(--border-default)] bg-white p-2"
            />
            <p className="text-caption text-xs text-[var(--text-tertiary)]">
              Open the Expo Go app, then scan this QR code.
            </p>
            <p className="text-caption text-xs text-[var(--text-tertiary)]">
              Or use the QR code in the preview pane to the right.
            </p>
          </div>
        ) : (
          <p className="text-caption text-xs text-[var(--text-tertiary)]">
            Build your app first, then the QR code will appear here.
          </p>
        )}
      </div>
    </Modal>
  );
}
