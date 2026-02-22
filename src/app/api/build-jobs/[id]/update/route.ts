import {
  appendBuildJobLogs,
  getBuildJob,
  setBuildJobStatus,
  setBuildJobCompilerErrors,
  setBuildJobAutoFixInProgress,
} from "@/lib/buildJobs";
import { sendBuildNotification } from "@/lib/apns";
import { setProjectIPA } from "@/lib/ipaStore";

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
  try {
    console.log(`[auto-fix] Triggering: POST ${url} (failedJobId=${jobId})`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ failedJobId: jobId }),
    });
    const text = await res.text();
    console.log(`[auto-fix] Response ${res.status}: ${text.slice(0, 300)}`);
  } catch (err) {
    console.error(`[auto-fix] Fetch failed for job ${jobId}:`, err);
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
    sendBuildNotification(
      freshJob.request.projectName,
      "succeeded"
    ).catch((err) => console.error("[apns] Error sending success notification:", err));
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
    sendBuildNotification(
      freshJob.request.projectName,
      "failed",
      freshJob.error ?? "Build failed after all attempts"
    ).catch((err) => console.error("[apns] Error sending failure notification:", err));
  }

  return Response.json({ ok: true });
}
