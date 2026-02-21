import { appendBuildJobLogs, getBuildJob, setBuildJobStatus } from "@/lib/buildJobs";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRunnerAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const job = getBuildJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const logs = Array.isArray(body?.logs) ? body.logs.filter((x: any) => typeof x === "string") : [];
  if (logs.length) appendBuildJobLogs(id, logs);

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

  return Response.json({ ok: true });
}

