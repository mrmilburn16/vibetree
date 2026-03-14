"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Unlock, Loader2, Lock } from "lucide-react";
import { Modal, Button, QRCode, Input } from "@/components/ui";
import type { PlanId } from "@/hooks/useSimulatorWallet";

const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";
const PROJECT_FILES_STORAGE_PREFIX = "vibetree-project-files:";
const XCODE_BUNDLE_ID_OVERRIDE_PREFIX = "vibetree-xcode-bundle-id:";
const XCODE_PREFERRED_DEVICE_PREFIX = "vibetree-xcode-preferred-device:";
const SESSION_EXPIRED_MESSAGE = "Session expired — please refresh the page and try again.";
const TEAM_ID_REGEX = /^[A-Z0-9]{10}$/;
function isValidTeamId(value: string): boolean {
  return TEAM_ID_REGEX.test(value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""));
}

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
  isAgentTyping = false,
  expoUrl: expoUrlProp,
  onExpoUrl,
  projectType: projectTypeProp,
  backgroundInstallJobIdRef,
  onConsumedBackgroundJob,
  planId: planIdProp,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  /** When this becomes "live", preflight re-runs so Project files check updates. */
  buildStatus?: "idle" | "building" | "live" | "failed";
  /** When true, agent is generating; disable Install so user installs the updated version when ready. */
  isAgentTyping?: boolean;
  expoUrl?: string | null;
  onExpoUrl?: (url: string) => void;
  projectType?: "standard" | "pro";
  /** If set, Install on iPhone can use this job id instead of POSTing build-install (background build from validation). */
  backgroundInstallJobIdRef?: React.MutableRefObject<string | null>;
  /** Called when install flow completes (success or failure) so parent can clear the background job ref. */
  onConsumedBackgroundJob?: () => void;
  /** User's current plan ID — used to gate Xcode export for free users. */
  planId?: PlanId;
}) {
  const [expoUrlLocal, setExpoUrlLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [exportUpgradeRequired, setExportUpgradeRequired] = useState(false);

  // Derive whether the user can export based on their plan
  const canExport = planIdProp === "starter" || planIdProp === "builder" || planIdProp === "pro";
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
  const [launchStatus, setLaunchStatus] = useState<"idle" | "launching" | "succeeded" | "failed">("idle");
  const [launchJobId, setLaunchJobId] = useState<string | null>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [showTeamIdInput, setShowTeamIdInput] = useState(false);
  const [teamIdValidationError, setTeamIdValidationError] = useState<string | null>(null);

  const projectType =
    projectTypeProp ??
    (typeof window !== "undefined" &&
    localStorage.getItem(PROJECT_TYPE_STORAGE_KEY) === "pro"
      ? "pro"
      : "standard");

  const expoUrl = expoUrlProp ?? expoUrlLocal;

  const { checks, allPassed, loading: preflightLoading, recheck } =
    usePreflightChecks(projectId, teamId, isOpen && projectType === "pro", buildStatus);

  // Load team ID from Firestore (user doc); preferred device and bundle override from localStorage
  useEffect(() => {
    if (!isOpen || !projectId) return;
    if (typeof window !== "undefined") {
      (async () => {
        try {
          const res = await fetch("/api/user/development-team");
          if (res.ok) {
            const data = (await res.json()) as { developmentTeamId?: string };
            const t = typeof data.developmentTeamId === "string" ? data.developmentTeamId.trim() : "";
            setTeamId(t);
          }
        } catch {
          // keep empty on error
        }
      })();
      try {
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
        if (status === "succeeded" || status === "failed") {
          const jobError = typeof job.error === "string" ? job.error : null;
          const isAuthError = jobError != null && (/unauthorized|401/i.test(jobError) || jobError === "Unauthorized");
          setError(jobError != null ? (isAuthError ? SESSION_EXPIRED_MESSAGE : jobError) : null);
          onConsumedBackgroundJob?.();
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
  }, [isOpen, installJobId, onConsumedBackgroundJob]);

  // Poll launch-only job
  useEffect(() => {
    if (!isOpen || !launchJobId || launchStatus !== "launching") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/build-jobs/${launchJobId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        const job = data?.job;
        if (!job || cancelled) return;
        const status = typeof job.status === "string" ? job.status : null;
        if (status === "succeeded") {
          setLaunchStatus("succeeded");
          setLaunchMessage(null);
          return;
        }
        if (status === "failed") {
          setLaunchStatus("failed");
          setLaunchMessage(typeof job.error === "string" ? job.error : "Unlock your iPhone first, then try again.");
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        if (!cancelled) setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [isOpen, launchJobId, launchStatus]);

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
    setLaunchStatus("idle");
    setLaunchJobId(null);
    setLaunchMessage(null);
    try {
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      const sessionData = await sessionRes.json().catch(() => ({}));
      const hasValidSession = sessionRes.ok && sessionData?.user != null;
      if (sessionRes.status === 401 || !hasValidSession) {
        setError(SESSION_EXPIRED_MESSAGE);
        setInstallLoading(false);
        return;
      }

      const backgroundJobId = backgroundInstallJobIdRef?.current ?? null;
      if (backgroundJobId) {
        const jobRes = await fetch(`/api/build-jobs/${backgroundJobId}`);
        if (jobRes.ok) {
          const jobData = await jobRes.json().catch(() => ({}));
          const job = jobData?.job;
          const status = typeof job?.status === "string" ? job.status : null;
          if (status === "succeeded") {
            setInstallJobId(backgroundJobId);
            setInstallStatus("succeeded");
            setInstallStartedAt(Date.now());
            const logs = Array.isArray(job?.logs) ? job.logs.filter((x: unknown) => typeof x === "string") : [];
            setInstallLogTail(logs.slice(-10));
            onConsumedBackgroundJob?.();
            setInstallLoading(false);
            return;
          }
          if (status === "failed") {
            onConsumedBackgroundJob?.();
            // Fall through to existing POST flow
          } else {
            setInstallJobId(backgroundJobId);
            setInstallStatus(status === "running" ? "running" : "queued");
            setInstallLoading(false);
            return;
          }
        }
      }

      let files: { path: string; content: string }[] = [];
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(
            `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`
          );
          const parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed?.files) && parsed.files.length > 0) {
            try {
              localStorage.setItem(
                `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`,
                JSON.stringify({ updatedAt: Date.now() })
              );
            } catch {}
          }
        } catch {}
      }
      try {
        const filesRes = await fetch(`/api/projects/${projectId}/files`);
        if (filesRes.ok) {
          const data = (await filesRes.json()) as { files?: { path: string; content: string }[] };
          if (Array.isArray(data.files) && data.files.length > 0) {
            files = data.files;
          }
        }
      } catch {}

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
      setTeamIdValidationError(null);
      if (projectType === "pro" && (!finalTeamId || !isValidTeamId(finalTeamId))) {
        setTeamIdValidationError("Team ID must be exactly 10 letters or numbers. Find it in Apple Developer → Account → Membership details.");
        setInstallStatus("failed");
        setInstallLoading(false);
        return;
      }
      if (finalTeamId && isValidTeamId(finalTeamId)) {
        try {
          await fetch("/api/user/development-team", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ developmentTeamId: finalTeamId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") }),
          });
        } catch {
          // non-blocking
        }
      }

      if (files.length > 0) {
        try {
          await fetch(`/api/projects/${projectId}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files }),
          });
        } catch {}
      }

      const res = await fetch(`/api/projects/${projectId}/build-install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.length > 0 ? files : undefined,
          projectName,
          bundleId: finalBundleId,
          developmentTeam: finalTeamId || undefined,
          autoFix: buildStatus !== "live",
        }),
      });
      if (res.status === 401) {
        setError(SESSION_EXPIRED_MESSAGE);
        setInstallStatus("failed");
        setInstallLoading(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error === "mac_runner_offline" ? (data?.message ?? "Build server is offline. Builds are paused until the server comes back online.") : (data?.error ?? "Install request failed");
        throw new Error(msg);
      }
      const data = await res.json().catch(() => ({}));
      const jobId = typeof data?.job?.id === "string" ? data.job.id : null;
      if (!jobId) throw new Error("No job id returned");
      setInstallJobId(jobId);
      setInstallStatus("queued");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Install failed. Try again.";
      const isAuthError = /unauthorized|401/i.test(raw) || raw === "Unauthorized";
      setError(isAuthError ? SESSION_EXPIRED_MESSAGE : raw);
      setInstallStatus("failed");
    } finally {
      setInstallLoading(false);
    }
  }

  async function handleLaunchApp() {
    setLaunchStatus("launching");
    setLaunchMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/launch-on-device`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLaunchStatus("failed");
        setLaunchMessage((data?.message ?? data?.error ?? "Launch request failed. Try again.") as string);
        return;
      }
      const data = (await res.json()) as { job?: { id?: string } };
      const jobId = data?.job?.id;
      if (jobId) {
        setLaunchJobId(jobId);
      } else {
        setLaunchStatus("failed");
        setLaunchMessage("Launch request failed. Try again.");
      }
    } catch {
      setLaunchStatus("failed");
      setLaunchMessage("Launch request failed. Try again.");
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
          let files: { path: string; content: string }[] = [];
          const raw = localStorage.getItem(
            `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`
          );
          const parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed?.files) && parsed.files.length > 0) {
            try {
              localStorage.setItem(
                `${PROJECT_FILES_STORAGE_PREFIX}${projectId}`,
                JSON.stringify({ updatedAt: Date.now() })
              );
            } catch {}
          }
          const filesRes = await fetch(`/api/projects/${projectId}/files`);
          if (filesRes.ok) {
            const data = (await filesRes.json()) as { files?: { path: string; content: string }[] };
            if (Array.isArray(data.files) && data.files.length > 0) {
              files = data.files;
            }
          }
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
        if (res.status === 403 && data?.error === "upgrade_required") {
          setExportUpgradeRequired(true);
          return;
        }
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
    const installFailureInLogs = installLogTail.some((l) =>
      /Install failed \(exit|Connection reset by peer|ControlChannelConnectionError/i.test(l)
    );
    const installActuallyFailed =
      installFailureInLogs ||
      (installStatus === "failed" && error != null && /install failed|Build succeeded but install/i.test(error));
    const installSucceededOnlyWhenInstalled =
      installStatus === "succeeded" && !installActuallyFailed;

    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Run on your iPhone">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Build and install your app directly to your iPhone.
          </p>

          {checks && !preflightLoading && (!checks.runner.ok || !checks.device.ok || !checks.teamId.ok) && (
            <div className="rounded border border-[var(--semantic-warning)]/50 bg-[var(--semantic-warning)]/10 px-3 py-2.5 text-sm">
              <p className="mb-1.5 font-medium text-[var(--text-primary)]">To run on your iPhone, fix the following:</p>
              <ul className="list-inside list-disc space-y-0.5 text-[var(--text-secondary)]">
                {!checks.runner.ok && (
                  <li>Mac runner: run <code className="rounded bg-[var(--background-tertiary)] px-1">npm run mac-runner</code> in a terminal</li>
                )}
                {!checks.device.ok && (
                  <li>iPhone: connect via USB or same WiFi</li>
                )}
                {!checks.teamId.ok && (
                  <li>Team ID: enter above or set in .env (<code className="rounded bg-[var(--background-tertiary)] px-1">DEFAULT_DEVELOPMENT_TEAM</code>)</li>
                )}
              </ul>
            </div>
          )}

          {error && (
            <div
              className={
                /locked/i.test(error)
                  ? "flex items-start gap-3 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2.5"
                  : "rounded border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2"
              }
            >
              {/locked/i.test(error) && (
                <Unlock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
              )}
              <p
                className={
                  /locked/i.test(error)
                    ? "text-sm font-medium text-amber-200"
                    : "text-sm text-red-400"
                }
              >
                {error}
              </p>
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
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          id="preflight-team-id"
                          value={teamId}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                            setTeamId(v);
                            setTeamIdValidationError(null);
                          }}
                          onBlur={async () => {
                            const v = teamId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
                            if (v.length === 10) {
                              try {
                                const res = await fetch("/api/user/development-team", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ developmentTeamId: v }),
                                });
                                if (res.ok) recheck();
                              } catch {
                                // non-blocking
                              }
                            }
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
                          onClick={async () => {
                            const v = teamId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
                            if (v.length !== 10) {
                              setTeamIdValidationError("Team ID must be exactly 10 letters or numbers.");
                              return;
                            }
                            setTeamIdValidationError(null);
                            try {
                              const res = await fetch("/api/user/development-team", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ developmentTeamId: v }),
                              });
                              if (res.ok) recheck();
                              else {
                                const data = await res.json().catch(() => ({}));
                                setTeamIdValidationError((data?.error as string) || "Failed to save.");
                              }
                            } catch {
                              setTeamIdValidationError("Failed to save.");
                            }
                          }}
                          className="cursor-pointer whitespace-nowrap rounded bg-[var(--primary-default)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
                        >
                          Save
                        </button>
                      </div>
                      {teamIdValidationError && (
                        <p className="text-xs text-red-500">{teamIdValidationError}</p>
                      )}
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
              ok={checks?.files?.ok ?? null}
              loading={preflightLoading && !checks}
              label="Project files"
              detail={
                checks?.files?.ok
                  ? `${checks.files.count ?? 0} Swift file(s) ready`
                  : checks && checks.files && !checks.files.ok
                    ? "No app files — build the app in chat first"
                    : undefined
              }
            />
          </div>

          {teamIdValidationError && (
            <p className="rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {teamIdValidationError}
            </p>
          )}

          {/* ── Install button ── */}
          <Button
            type="button"
            onClick={handleInstallOnDevice}
            disabled={
              !allPassed || installLoading || isBuilding || isAgentTyping
            }
            className="w-full"
          >
            {installLoading
              ? "Starting\u2026"
              : isAgentTyping
                ? "Wait for agent to finish…"
                : isBuilding
                ? `Building & installing\u2026 (${installElapsed}s)`
                : installSucceededOnlyWhenInstalled
                  ? "Re-install on iPhone"
                  : "Install on iPhone"}
          </Button>

          {/* ── Build progress ── */}
          {installStatus && (
              <div className="rounded border border-[var(--border-default)] bg-[var(--background-default)] p-3">
                {installActuallyFailed ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400">&#9888;</span>
                      <span className="text-sm font-medium text-[var(--text-default)]">
                        Build succeeded but install failed
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Unplug and replug your iPhone, keep it unlocked, and tap Install again.
                    </p>
                    {installLogTail.length > 0 && (
                      <pre className="mt-2 max-h-[120px] overflow-auto rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {installLogTail.join("\n")}
                      </pre>
                    )}
                  </>
                ) : installSucceededOnlyWhenInstalled &&
                  installLogTail.some((l) =>
                    /installed but could not auto-launch|installed but auto-launch failed|BSErrorCodeDescription = Locked/i.test(l)
                  ) ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">&#10003;</span>
                      <span className="text-sm font-medium text-[var(--text-default)]">
                        App installed successfully!
                      </span>
                    </div>
                    <div className="mt-2 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                      Couldn&apos;t auto-launch — your iPhone was locked.
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleLaunchApp}
                        disabled={launchStatus === "launching"}
                        className="w-full"
                      >
                        {launchStatus === "launching" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            Launching…
                          </>
                        ) : (
                          "Launch App"
                        )}
                      </Button>
                      {launchStatus === "succeeded" && (
                        <p className="text-sm text-green-400">App launched! Check your iPhone.</p>
                      )}
                      {launchStatus === "failed" && launchMessage && (
                        <p className="text-sm text-amber-200">{launchMessage}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {isBuilding && (
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--primary-default)]" />
                      )}
                      {installSucceededOnlyWhenInstalled && (
                        <span className="text-green-400">&#10003;</span>
                      )}
                      {installStatus === "failed" && !installActuallyFailed && (
                        <span className="text-red-400">&#10007;</span>
                      )}
                      {installActuallyFailed && (
                        <span className="text-amber-400">&#9888;</span>
                      )}
                      <span
                        className={
                          installSucceededOnlyWhenInstalled
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
                        {installSucceededOnlyWhenInstalled &&
                          (error && /locked/i.test(error)
                            ? "Unlock your iPhone and tap Install again."
                            : "Your app is installed! Check your iPhone.")}
                        {installStatus === "failed" &&
                          (installActuallyFailed
                            ? "Build succeeded but install failed — unplug and replug your iPhone, keep it unlocked, and tap Install again."
                            : "Install failed \u2014 try downloading for Xcode instead.")}
                      </span>
                    </div>
                    {installLogTail.length > 0 && (
                      <pre className="mt-2 max-h-[120px] overflow-auto rounded border border-[var(--border-default)] bg-[var(--background-secondary)] p-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {installLogTail.join("\n")}
                      </pre>
                    )}
                  </>
                )}
              </div>
          )}

          {/* ── Fallback download link ── */}
          <div className="pt-1 text-center">
            {canExport ? (
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
            ) : (
              <span
                title="Available on paid plans."
                className="inline-flex cursor-not-allowed items-center gap-1.5 text-xs text-[var(--text-tertiary)] opacity-60"
              >
                <Lock className="h-3 w-3 shrink-0" />
                Or download Xcode project (.zip)
                <span className="rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--button-primary-bg)]/20 text-[var(--link-default)]">
                  Paid
                </span>
              </span>
            )}
            {exportUpgradeRequired && (
              <p className="mt-2 text-xs text-[var(--badge-error)]">
                Xcode export is a paid feature.{" "}
                <Link href="/pricing" className="font-medium text-[var(--link-default)] hover:underline">
                  Upgrade your plan
                </Link>{" "}
                to download your project&apos;s source code.
              </p>
            )}
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
