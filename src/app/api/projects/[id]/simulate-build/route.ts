import { appendBuildJobLogs, createBuildJob, setBuildJobStatus } from "@/lib/buildJobs";
import { sendBackgroundRefreshPush } from "@/lib/apns";
import { ensureProject, getProject } from "@/lib/projectStore";

type SimBody = {
  projectName?: string;
  bundleId?: string;
  durationSeconds?: number;
  fail?: boolean;
};

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function isValidBundleId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);
}

// Keep references so dev server doesn't GC timers.
const g = globalThis as unknown as { __simBuildTimers?: Map<string, { iv?: NodeJS.Timeout; done?: NodeJS.Timeout }> };
if (!g.__simBuildTimers) g.__simBuildTimers = new Map();
const timers = g.__simBuildTimers;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const allow = process.env.NODE_ENV !== "production" || process.env.ALLOW_SIMULATED_BUILDS === "true";
  if (!allow) {
    return Response.json({ error: "Simulated builds are disabled on this server." }, { status: 403 });
  }

  const { id: projectId } = await params;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as SimBody;
  const providedName = typeof body?.projectName === "string" ? body.projectName.trim() : "";
  const providedBundleId = typeof body?.bundleId === "string" ? body.bundleId.trim() : "";
  const durationSeconds =
    typeof body?.durationSeconds === "number" && Number.isFinite(body.durationSeconds) ? body.durationSeconds : 35;
  const fail = body?.fail === true;

  const project = getProject(projectId) ?? ensureProject(projectId, providedName || "Untitled app");
  const bundleId = isValidBundleId(providedBundleId) ? providedBundleId : (project.bundleId || "com.vibetree.app");

  const job = createBuildJob({
    projectId,
    projectName: project.name || providedName || "Simulated build",
    bundleId,
    autoFix: false,
    attempt: 1,
    maxAttempts: 1,
  });

  appendBuildJobLogs(job.id, [
    `[sim] Queued simulated build for ${job.request.projectName}`,
    `[sim] (no credits) duration=${clampInt(durationSeconds, 5, 180)}s`,
  ]);

  // If APNs is configured, try to wake the phone so it can refresh build state.
  sendBackgroundRefreshPush(`sim_build_queued:${job.id}`).catch(() => {});

  // Transition to running shortly after creation.
  setTimeout(() => {
    setBuildJobStatus(job.id, { status: "running", startedAt: Date.now(), runnerId: "simulator" });
    appendBuildJobLogs(job.id, ["[sim] Starting xcodebuild…", "[sim] CompileSwiftSources…"]);
    sendBackgroundRefreshPush(`sim_build_running:${job.id}`).catch(() => {});
  }, 600);

  // Stream some fake logs while running.
  const startedAt = Date.now() + 600;
  const total = clampInt(durationSeconds, 5, 180);
  let tick = 0;
  const iv = setInterval(() => {
    tick += 1;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    appendBuildJobLogs(job.id, [`[sim] Build step ${tick}… (elapsed ${elapsed}s)`]);
  }, 2000);

  // Finish.
  const done = setTimeout(() => {
    clearInterval(iv);
    const finishedAt = Date.now();
    setBuildJobStatus(job.id, {
      status: fail ? "failed" : "succeeded",
      finishedAt,
      exitCode: fail ? 1 : 0,
      ...(fail ? { error: "Simulated failure" } : {}),
    });
    appendBuildJobLogs(job.id, [fail ? "[sim] Build failed." : "[sim] Build succeeded."]);
    sendBackgroundRefreshPush(`sim_build_done:${job.id}`).catch(() => {});
    timers.delete(job.id);
  }, (total + 1) * 1000);

  timers.set(job.id, { iv, done });

  return Response.json({ job });
}

