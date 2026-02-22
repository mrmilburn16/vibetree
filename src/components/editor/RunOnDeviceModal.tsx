"use client";

import { useState, useEffect } from "react";
import { Modal, Button, QRCode, Input } from "@/components/ui";

const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";
const PROJECT_FILES_STORAGE_PREFIX = "vibetree-project-files:";
const XCODE_TEAM_ID_STORAGE_PREFIX = "vibetree-xcode-team-id:";
const XCODE_BUNDLE_ID_OVERRIDE_PREFIX = "vibetree-xcode-bundle-id:";
const XCODE_PREFERRED_DEVICE_PREFIX = "vibetree-xcode-preferred-device:";

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
  const [preferredRunDevice, setPreferredRunDevice] = useState("");
  const [bundleIdOverride, setBundleIdOverride] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validateLoading, setValidateLoading] = useState(false);
  const [validateJobId, setValidateJobId] = useState<string | null>(null);
  const [validateStatus, setValidateStatus] = useState<string | null>(null);
  const [validateLogTail, setValidateLogTail] = useState<string[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [validateStartedAt, setValidateStartedAt] = useState<number | null>(null);
  const [validateElapsed, setValidateElapsed] = useState(0);
  const [validateAttempt, setValidateAttempt] = useState(1);
  const [validateMaxAttempts, setValidateMaxAttempts] = useState(3);
  const [validateFixing, setValidateFixing] = useState(false);
  const [validateHadCompilerErrors, setValidateHadCompilerErrors] = useState(false);
  const [validateFailureReason, setValidateFailureReason] = useState<string | null>(null);
  const [errorCopyFeedback, setErrorCopyFeedback] = useState(false);

  const projectType =
    projectTypeProp ??
    (typeof window !== "undefined" && (localStorage.getItem(PROJECT_TYPE_STORAGE_KEY) === "pro" ? "pro" : "standard"));

  const expoUrl = expoUrlProp ?? expoUrlLocal;

  useEffect(() => {
    if (!isOpen || !projectId) return;
    if (typeof window !== "undefined") {
      try {
        const t = localStorage.getItem(`${XCODE_TEAM_ID_STORAGE_PREFIX}${projectId}`) ?? "";
        let d = localStorage.getItem(`${XCODE_PREFERRED_DEVICE_PREFIX}${projectId}`) ?? "";
        if (!d) {
          const universal = localStorage.getItem("vibetree-universal-defaults");
          if (universal) {
            try {
              const parsed = JSON.parse(universal);
              if (typeof parsed.preferredRunDevice === "string") d = parsed.preferredRunDevice;
            } catch {}
          }
        }
        const b = localStorage.getItem(`${XCODE_BUNDLE_ID_OVERRIDE_PREFIX}${projectId}`) ?? "";
        setTeamId(t);
        setPreferredRunDevice(d);
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
    (async () => {
      try {
        let res = await fetch(`/api/projects/${projectId}/run-on-device?projectType=standard`);
        let data = await res.json().catch(() => ({}));
        if (data.expoUrl) {
          setExpoUrlLocal(data.expoUrl);
          onExpoUrl?.(data.expoUrl);
          return;
        }
        const noFiles = res.status === 400 && (data.code === "NO_FILES" || data.code === "NO_APP");
        if (noFiles && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(`${PROJECT_FILES_STORAGE_PREFIX}${projectId}`);
            const parsed = raw ? JSON.parse(raw) : null;
            const files = Array.isArray(parsed?.files) ? parsed.files : [];
            if (files.length > 0) {
              res = await fetch(`/api/projects/${projectId}/run-on-device?projectType=standard`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ files }),
              });
              data = await res.json().catch(() => ({}));
              if (data.expoUrl) {
                setExpoUrlLocal(data.expoUrl);
                onExpoUrl?.(data.expoUrl);
                return;
              }
            }
          } catch {
            // ignore
          }
        }
        if (data.error) setError(data.error);
      } catch {
        setError("Could not start preview. Try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, projectId, projectType, expoUrlProp, onExpoUrl]);

  useEffect(() => {
    if (!isOpen) return;
    if (!validateJobId) return;
    let cancelled = false;
    let currentJobId = validateJobId;

    const poll = async () => {
      try {
        const res = await fetch(`/api/build-jobs/${currentJobId}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const job = data?.job;
        if (!job || cancelled) return;

        const status = typeof job.status === "string" ? job.status : null;
        const attempt = typeof job.request?.attempt === "number" ? job.request.attempt : 1;
        const maxAttempts = typeof job.request?.maxAttempts === "number" ? job.request.maxAttempts : 5;
        const nextJobId = typeof job.nextJobId === "string" ? job.nextJobId : null;

        setValidateAttempt(attempt);
        setValidateMaxAttempts(maxAttempts);

        if (status === "failed" && nextJobId) {
          setValidateFixing(true);
          setValidateStatus("fixing");
          setValidateLogTail([`Auto-fixing Swift errors (attempt ${attempt + 1}/${maxAttempts})…`]);
          currentJobId = nextJobId;
          setValidateJobId(nextJobId);
          setTimeout(poll, 2000);
          return;
        }

        setValidateFixing(false);
        setValidateStatus(status);
        const logs = Array.isArray(job.logs) ? job.logs.filter((x: any) => typeof x === "string") : [];
        setValidateLogTail(logs.slice(-10));
        if (status === "failed") {
          setValidateHadCompilerErrors((Array.isArray(job.compilerErrors) ? job.compilerErrors.length : 0) > 0);
          const err = typeof job.error === "string" && job.error.trim() ? job.error.trim() : null;
          const firstCompiler = Array.isArray(job.compilerErrors) && job.compilerErrors.length > 0
            ? String(job.compilerErrors[0]).trim()
            : null;
          setValidateFailureReason(err || firstCompiler || (logs.length > 0 ? "See log below." : null));
        } else {
          setValidateFailureReason(null);
        }

        if (status === "succeeded" || status === "failed") {
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        // ignore
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [isOpen, validateJobId]);

  useEffect(() => {
    if (!validateStartedAt || !validateStatus) return;
    if (validateStatus === "succeeded" || validateStatus === "failed") return;
    const iv = setInterval(() => {
      setValidateElapsed(Math.floor((Date.now() - validateStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [validateStartedAt, validateStatus, validateFixing]);

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
                preferredRunDevice: preferredRunDevice.trim() || undefined,
                timezoneOffsetMinutes: new Date().getTimezoneOffset(),
              }),
            });
          }
        } catch {
          // ignore and fall back to server cache
        }
      }

      // Fallback: server-side in-memory cache (include team, preferred device, timezone so signing/README/dates are correct)
      if (!res) {
        const q = new URLSearchParams();
        if (teamId.trim()) q.set("developmentTeam", teamId.trim());
        if (preferredRunDevice.trim()) q.set("preferredRunDevice", preferredRunDevice.trim());
        q.set("timezoneOffsetMinutes", String(new Date().getTimezoneOffset()));
        res = await fetch(`/api/projects/${projectId}/export-xcode?${q.toString()}`);
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

  async function handleValidateBuild() {
    setValidateLoading(true);
    setError(null);
    setValidateStatus("queued");
    setValidateLogTail([]);
    try {
      // Prefer client-cached Swift files (survives refresh/dev reload).
      let files: any[] = [];
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(`${PROJECT_FILES_STORAGE_PREFIX}${projectId}`);
          const parsed = raw ? JSON.parse(raw) : null;
          const arr = Array.isArray(parsed?.files) ? parsed.files : [];
          files = arr;
        } catch {}
      }

      // Best-effort: include project name + bundle id for consistent scheme/id.
      let projectName = "Untitled app";
      let bundleId = "";
      if (typeof window !== "undefined") {
        try {
          const projectsRaw = localStorage.getItem("vibetree-projects");
          const projects = projectsRaw ? JSON.parse(projectsRaw) : [];
          const p = Array.isArray(projects) ? projects.find((x: any) => x?.id === projectId) : null;
          if (p?.name) projectName = String(p.name);
          if (p?.bundleId) bundleId = String(p.bundleId);
        } catch {}
      }

      const finalBundleId = bundleIdOverride.trim() || bundleId;
      const finalTeamId = teamId.trim();

      const res = await fetch(`/api/projects/${projectId}/validate-xcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(files.length > 0 ? { files } : {}),
          projectName,
          bundleId: finalBundleId,
          developmentTeam: finalTeamId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Validation request failed");
      }
      const data = await res.json().catch(() => ({}));
      const jobId = typeof data?.job?.id === "string" ? data.job.id : null;
      if (!jobId) throw new Error("No job id returned");
      setValidateJobId(jobId);
      setValidateStatus("queued");
      setValidateStartedAt(Date.now());
      setValidateElapsed(0);
      setValidateAttempt(1);
      setValidateMaxAttempts(3);
      setValidateFixing(false);
      setValidateHadCompilerErrors(false);
      setValidateFailureReason(null);
      setValidateLogTail([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed. Try again.");
      setValidateStatus("failed");
    } finally {
      setValidateLoading(false);
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
              Pro apps are native Swift/SwiftUI. Download for Xcode (zip), unzip, double‑click the project, then Run on your iPhone or simulator. If Xcode defaults to a simulator, select your physical iPhone from the device dropdown once—Xcode will remember it.
            </p>
            <div className="rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2">
              <p className="text-caption text-xs text-[var(--text-tertiary)]">
                Set your <span className="text-[var(--text-secondary)]">Team ID</span> below once—we’ll embed it in the zip so Xcode won’t ask you to pick a team. (That team appears in Xcode as e.g. &quot;Michael Milburn (Individual)&quot;.)
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            {validateStatus === "succeeded" && (
              <p className="text-sm text-[var(--text-secondary)]">
                Build validated. Download the zip below, then unzip and open in Xcode to run on your iPhone.
              </p>
            )}
            <Button
              type="button"
              onClick={handleDownloadForXcode}
              disabled={downloadLoading}
              className="w-full"
            >
              {downloadLoading ? "Preparing…" : "Download for Xcode (.zip)"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleValidateBuild}
              disabled={validateLoading}
              className="w-full"
            >
              {validateLoading ? "Queueing build check…" : validateStatus === "succeeded" ? "Re-validate build" : "Validate build on Mac (xcodebuild)"}
            </Button>
            {validateStatus && (
              <div className="rounded border border-[var(--border-default)] bg-[var(--background-default)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    {(validateStatus === "queued" || validateStatus === "running" || validateStatus === "fixing") && (
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--primary-default)]" />
                    )}
                    {validateStatus === "succeeded" && (
                      <span className="text-green-400">&#10003;</span>
                    )}
                    {validateStatus === "failed" && (
                      <span className="text-red-400">&#10007;</span>
                    )}
                    <span>
                      {validateStatus === "queued" && `Waiting for runner… (${validateElapsed}s)`}
                      {validateStatus === "running" && `Building with xcodebuild… (${validateElapsed}s)${validateAttempt > 1 ? ` — Attempt ${validateAttempt}/${validateMaxAttempts}` : ""}`}
                      {validateStatus === "fixing" && `Auto-fixing Swift errors… (${validateElapsed}s) — Attempt ${validateAttempt + 1}/${validateMaxAttempts}`}
                      {validateStatus === "succeeded" && (validateAttempt > 1 ? `Build succeeded on attempt ${validateAttempt}/${validateMaxAttempts}` : "Build succeeded")}
                      {validateStatus === "failed" && (
                        validateFailureReason
                          ? `Build failed: ${validateFailureReason}`
                          : (validateAttempt > 1 ? `Build failed after ${validateAttempt} attempt${validateAttempt > 1 ? "s" : ""}` : "Build failed")
                      )}
                      {validateStatus !== "queued" && validateStatus !== "running" && validateStatus !== "fixing" && validateStatus !== "succeeded" && validateStatus !== "failed" && validateStatus}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const statusLine = `Build validation status: ${validateStatus}${validateJobId ? ` · job ${validateJobId}` : ""}`;
                      const logBlock = validateLogTail.length > 0 ? `\n${validateLogTail.join("\n")}` : "";
                      const text = `${statusLine}${logBlock}`;
                      try {
                        await navigator.clipboard.writeText(text);
                        setCopyFeedback(true);
                        setTimeout(() => setCopyFeedback(false), 2000);
                      } catch {
                        // ignore
                      }
                    }}
                    className="shrink-0 rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-default)]"
                  >
                    {copyFeedback ? "Copied!" : "Copy"}
                  </button>
                </div>
                {validateLogTail.length > 0 && (
                  <pre className="mt-2 max-h-[160px] overflow-auto rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {validateLogTail.join("\n")}
                  </pre>
                )}
                {validateStatus === "failed" && !validateHadCompilerErrors && (
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    Auto-fix only runs for Swift compiler errors. This failure (e.g. ValidateEmbeddedBinary) may be due to signing or project setup—check the log above.
                  </p>
                )}
                {(validateStatus === "queued" || validateStatus === "running" || validateStatus === "fixing") && (
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    {validateStatus === "fixing"
                      ? "Sending compiler errors to LLM for auto-fix…"
                      : <>Requires a Mac runner with Xcode. Run <span className="font-mono">npm run mac-runner</span> on your Mac with{" "}<span className="font-mono">MAC_RUNNER_TOKEN</span> set.</>
                    }
                  </p>
                )}
              </div>
            )}
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
                    Find it: in Xcode, pick your team once, then open the .xcodeproj in a text editor and search for <span className="font-mono">DEVELOPMENT_TEAM</span>—the 10-character value is your Team ID.
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
              Unzip → double‑click the .xcodeproj → connect iPhone → Run. No Expo Go needed. If Xcode picks a simulator, choose your physical iPhone from the device dropdown (e.g. &quot;iPhone (9)&quot;) once—Xcode will remember it next time.
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
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm text-[var(--text-secondary)]">{error}</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(error);
                    setErrorCopyFeedback(true);
                    setTimeout(() => setErrorCopyFeedback(false), 2000);
                  } catch {
                    // ignore
                  }
                }}
                className="shrink-0 rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              >
                {errorCopyFeedback ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              {error.includes("Build your app") || error.includes("Generated app must include")
                ? "Describe an app in the chat (e.g. &quot;A simple counter app&quot;), wait for it to build, then try again."
                : "If you haven’t built an app yet, describe one in the chat first. Otherwise the Expo server may have failed—check the terminal where the dev server is running for details."}
            </p>
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
