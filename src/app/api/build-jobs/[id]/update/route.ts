import {
  appendBuildJobLogs,
  getBuildJob,
  setBuildJobStatus,
  setBuildJobCompilerErrors,
} from "@/lib/buildJobs";

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
  try {
    const base =
      requestOrigin ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;
    await fetch(`${base}/api/projects/${projectId}/auto-fix-build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ failedJobId: jobId }),
    });
  } catch (_) {
    // Best-effort; if it fails, the UI will show the failure and the user can retry manually.
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

  // Trigger auto-fix when a build fails and autoFix is enabled with remaining attempts.
  // Run auto-fix if we have parsed compiler errors OR build logs (fallback so we can try fixing from log output).
  const freshJob = getBuildJob(id);
  const hasErrors = (freshJob?.compilerErrors?.length ?? 0) > 0;
  const hasLogs = (freshJob?.logs?.length ?? 0) > 0;
  if (
    freshJob &&
    freshJob.status === "failed" &&
    freshJob.request.autoFix &&
    (freshJob.request.attempt ?? 1) < (freshJob.request.maxAttempts ?? 3) &&
    (hasErrors || hasLogs)
  ) {
    triggerAutoFix(freshJob.request.projectId, id, requestOrigin);
  }

  return Response.json({ ok: true });
}

