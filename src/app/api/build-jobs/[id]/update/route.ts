import {
  appendBuildJobLogs,
  getBuildJob,
  setBuildJobStatus,
  setBuildJobCompilerErrors,
  setBuildJobAutoFixInProgress,
} from "@/lib/buildJobs";
import { sendBackgroundRefreshPush, sendBuildNotification } from "@/lib/apns";
import { setProjectIPA } from "@/lib/ipaStore";
import { getProject } from "@/lib/projectStore";

function requireRunnerAuth(request: Request): { ok: true } | { ok: false; response: Response } {
  const token = process.env.MAC_RUNNER_TOKEN;
  if (!token) {
    return { ok: false, response: Response.json({ error: "Runner auth not configured" }, { status: 503 }) };
  }
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1] || m[1] !== token) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}

async function triggerAutoFix(
  projectId: string,
  jobId: string,
  requestOrigin?: string
): Promise<void> {
  const base =
    requestOrigin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `http://localhost:${process.env.PORT || 3001}`;
  const url = `${base}/api/projects/${projectId}/auto-fix-build`;
  const runnerToken = process.env.MAC_RUNNER_TOKEN;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (runnerToken) headers.Authorization = `Bearer ${runnerToken}`;
  try {
    console.log(`[auto-fix] Triggering: POST ${url} (failedJobId=${jobId})`);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ failedJobId: jobId }),
    });
    const text = await res.text();
    console.log(`[auto-fix] Response ${res.status}: ${text.slice(0, 300)}`);
    if (!res.ok) {
      setBuildJobAutoFixInProgress(jobId, false);
      return;
    }
    try {
      const data = JSON.parse(text) as { gaveUp?: boolean };
      if (data?.gaveUp) setBuildJobAutoFixInProgress(jobId, false);
    } catch {
      // ignore parse error
    }
  } catch (err) {
    console.error(`[auto-fix] Fetch failed for job ${jobId}:`, err);
    setBuildJobAutoFixInProgress(jobId, false);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRunnerAuth(request);
  if (!auth.ok) return auth.response;

  const host = request.headers.get("host");
  const requestOrigin =
    host && (request.url.startsWith("http://") || request.url.startsWith("https://"))
      ? new URL(request.url).origin
      : host
        ? `http://${host}`
        : undefined;
  const { id } = await params;
  const job = getBuildJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const logs = Array.isArray(body?.logs) ? body.logs.filter((x: any) => typeof x === "string") : [];
  if (logs.length) appendBuildJobLogs(id, logs);

  const compilerErrors = Array.isArray(body?.compilerErrors)
    ? body.compilerErrors.filter((x: any) => typeof x === "string")
    : [];
  if (compilerErrors.length) setBuildJobCompilerErrors(id, compilerErrors);

  const status = typeof body?.status === "string" ? body.status : undefined;
  const exitCode = typeof body?.exitCode === "number" ? body.exitCode : undefined;
  const error = typeof body?.error === "string" ? body.error : undefined;

  if (status === "running" || status === "succeeded" || status === "failed") {
    setBuildJobStatus(id, {
      status,
      ...(status === "succeeded" || status === "failed" ? { finishedAt: Date.now() } : {}),
      ...(exitCode !== undefined ? { exitCode } : {}),
      ...(error ? { error } : {}),
    });
  }

  if (typeof body?.ipaBase64 === "string" && body.ipaBase64.length > 0) {
    const ipaBuf = Buffer.from(body.ipaBase64, "base64");
    setProjectIPA(job.request.projectId, ipaBuf);
    const rec = getBuildJob(id);
    if (rec) rec.ipaPath = `in-memory:${job.request.projectId}`;
  }

  const freshJob = getBuildJob(id);
  const hasErrors = (freshJob?.compilerErrors?.length ?? 0) > 0;
  const hasLogs = (freshJob?.logs?.length ?? 0) > 0;
  const attempt = freshJob?.request.attempt ?? 1;
  const maxAttempts = freshJob?.request.maxAttempts ?? 5;

  if (freshJob && freshJob.status === "succeeded") {
    const displayName = getProject(freshJob.request.projectId)?.name?.trim() || freshJob.request.projectName;
    const installedOnDevice = body?.installedOnDevice === true;
    console.log(`[build-jobs] Job ${id} succeeded, sending push notification for "${displayName}"${installedOnDevice ? " (installed on device)" : ""}…`);
    try {
      await sendBackgroundRefreshPush(`build_succeeded:${id}`);
      await sendBuildNotification(displayName, "succeeded", undefined, {
        installedOnDevice,
        projectId: freshJob.request.projectId,
      });
    } catch (err) {
      console.error("[apns] Error sending build success push:", err);
    }
  }

  if (freshJob && freshJob.status === "failed") {
    console.log(
      `[auto-fix] Job ${id} failed. autoFix=${freshJob.request.autoFix}, ` +
      `attempt=${attempt}/${maxAttempts}, hasErrors=${hasErrors}, hasLogs=${hasLogs}`
    );
  }

  if (
    freshJob &&
    freshJob.status === "failed" &&
    freshJob.request.autoFix &&
    attempt < maxAttempts &&
    (hasErrors || hasLogs)
  ) {
    console.log(`[auto-fix] Triggering auto-fix for job ${id} (attempt ${attempt}/${maxAttempts})`);
    setBuildJobAutoFixInProgress(id, true);
    triggerAutoFix(freshJob.request.projectId, id, requestOrigin);
  } else if (freshJob && freshJob.status === "failed") {
    console.log(
      `[auto-fix] NOT triggering auto-fix for job ${id}: ` +
      `autoFix=${freshJob.request.autoFix}, ` +
      `attempt=${attempt} < maxAttempts=${maxAttempts} = ${attempt < maxAttempts}, ` +
      `hasErrors||hasLogs=${hasErrors || hasLogs}`
    );
    const displayName = getProject(freshJob.request.projectId)?.name?.trim() || freshJob.request.projectName;
    const isDeviceInstall = freshJob.request.outputType === "device";
    const detail = isDeviceInstall
      ? `${freshJob.error ?? "Install failed."} Unlock your iPhone, keep it connected via USB, and try again.`
      : (freshJob.error ?? "Build failed after all attempts");
    try {
      await sendBackgroundRefreshPush(`build_failed:${id}`);
      await sendBuildNotification(displayName, "failed", detail, {
        projectId: freshJob.request.projectId,
      });
    } catch (err) {
      console.error("[apns] Error sending build failure push:", err);
    }
  }

  return Response.json({ ok: true });
}
