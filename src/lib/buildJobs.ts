export type BuildJobStatus = "queued" | "running" | "succeeded" | "failed";

export type BuildJobCreateRequest = {
  projectId: string;
  projectName: string;
  bundleId: string;
  files?: Array<{ path: string; content: string }>;
  developmentTeam?: string;
  autoFix?: boolean;
  attempt?: number;
  maxAttempts?: number;
  parentJobId?: string;
  userPrompt?: string;
  /** "build" = simulator only (default); "ipa" = archive + export signed IPA; "device" = build + install via devicectl; "launch" = launch-only (devicectl device process launch, no build) */
  outputType?: "build" | "ipa" | "device" | "launch";
};

export type BuildJobRecord = {
  id: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: BuildJobStatus;
  runnerId?: string;
  request: BuildJobCreateRequest;
  logs: string[];
  exitCode?: number;
  error?: string;
  compilerErrors?: string[];
  /** Full history of compiler errors per attempt (attempt number + errors). Appended on each failed attempt; retry job gets copy of parent history. */
  errorHistory?: Array<{ attempt: number; errors: string[] }>;
  /** Points to the retry job created by auto-fix. */
  nextJobId?: string;
  /** True while auto-fix is running; tells clients to keep polling. */
  autoFixInProgress?: boolean;
  /** Path to built IPA (set by runner when outputType=ipa). */
  ipaPath?: string;
  /** Updated on claim and every log append; used for stale-runner detection. */
  lastActivityAt?: number;
};

const MAX_LOG_LINES = 1500;
/** If a "running" job has no activity for this long, mark failed so Live Activities end (no re-queue). */
const STALE_JOB_TIMEOUT_MS = 5 * 60 * 1000;
/** Queued jobs older than this are marked failed so Live Activities don't show "building" forever. */
const QUEUED_ABANDON_MS = 30 * 60 * 1000;
/** Stuck job threshold: queued or running longer than this is marked failed (runner may be offline). */
const STUCK_JOB_MS = 10 * 60 * 1000;

// Use globalThis so the store survives Next.js hot-reloads and is shared across all routes.
const g = globalThis as unknown as { __buildJobs?: Map<string, BuildJobRecord>; __buildQueue?: string[] };
if (!g.__buildJobs) g.__buildJobs = new Map();
if (!g.__buildQueue) g.__buildQueue = [];
const jobs = g.__buildJobs;
const queue = g.__buildQueue;

function jobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createBuildJob(req: BuildJobCreateRequest): BuildJobRecord {
  const id = jobId();
  const rec: BuildJobRecord = {
    id,
    createdAt: Date.now(),
    status: "queued",
    request: req,
    logs: [],
  };
  jobs.set(id, rec);
  queue.push(id);
  return rec;
}

export function getBuildJob(id: string): BuildJobRecord | undefined {
  return jobs.get(id);
}

export function getAllBuildJobs(): BuildJobRecord[] {
  return Array.from(jobs.values());
}

export function appendBuildJobLogs(id: string, lines: string[]): void {
  const rec = jobs.get(id);
  if (!rec) return;
  rec.logs.push(...lines.filter((l) => typeof l === "string" && l.length > 0));
  if (rec.logs.length > MAX_LOG_LINES) {
    rec.logs = rec.logs.slice(rec.logs.length - MAX_LOG_LINES);
  }
  rec.lastActivityAt = Date.now();
  jobs.set(id, rec);
}

export function setBuildJobStatus(
  id: string,
  updates: Partial<Pick<BuildJobRecord, "status" | "startedAt" | "finishedAt" | "runnerId" | "exitCode" | "error">>
): void {
  const rec = jobs.get(id);
  if (!rec) return;
  Object.assign(rec, updates);
  jobs.set(id, rec);
}

export function setBuildJobCompilerErrors(id: string, errors: string[]): void {
  const rec = jobs.get(id);
  if (!rec) return;
  rec.compilerErrors = errors;
  jobs.set(id, rec);
}

/** Append one attempt's errors to the job's error history (used when runner reports failure with compilerErrors). */
export function appendBuildJobErrorHistory(id: string, attempt: number, errors: string[]): void {
  const rec = jobs.get(id);
  if (!rec) return;
  const next = [...(rec.errorHistory ?? []), { attempt, errors }];
  rec.errorHistory = next;
  jobs.set(id, rec);
}

/** Set full error history (e.g. when creating a retry job, copy parent history + parent's attempt). */
export function setBuildJobErrorHistory(id: string, history: Array<{ attempt: number; errors: string[] }>): void {
  const rec = jobs.get(id);
  if (!rec) return;
  rec.errorHistory = history;
  jobs.set(id, rec);
}

export function setBuildJobNextJob(failedId: string, nextId: string): void {
  const rec = jobs.get(failedId);
  if (!rec) return;
  rec.nextJobId = nextId;
  rec.autoFixInProgress = false;
  jobs.set(failedId, rec);
}

export function setBuildJobAutoFixInProgress(id: string, inProgress: boolean): void {
  const rec = jobs.get(id);
  if (!rec) return;
  rec.autoFixInProgress = inProgress;
  jobs.set(id, rec);
}

/** Mark job as failed (cancelled). Returns true if job was queued, running, or stuck in auto-fix and is now cancelled. */
export function cancelBuildJob(id: string): boolean {
  const rec = jobs.get(id);
  if (!rec) return false;
  if (rec.status === "failed" && rec.autoFixInProgress) {
    rec.autoFixInProgress = false;
    rec.error = rec.error || "Auto-fix cancelled by user";
    jobs.set(id, rec);
    return true;
  }
  if (rec.status !== "queued" && rec.status !== "running") return false;
  rec.status = "failed";
  rec.finishedAt = Date.now();
  rec.error = "Cancelled by user";
  rec.runnerId = undefined;
  jobs.set(id, rec);
  return true;
}

/** Mark abandoned queued jobs (no runner picked up in time) and stale running jobs as failed so Live Activities end. */
export function markAbandonedJobs(): void {
  const now = Date.now();
  for (const rec of jobs.values()) {
    if (rec.status === "queued" && now - rec.createdAt > QUEUED_ABANDON_MS) {
      rec.status = "failed";
      rec.finishedAt = now;
      rec.error = "Build abandoned (no runner available)";
      jobs.set(rec.id, rec);
    } else if (rec.status === "running") {
      const lastActive = rec.lastActivityAt ?? rec.startedAt ?? rec.createdAt;
      if (now - lastActive > STALE_JOB_TIMEOUT_MS) {
        rec.status = "failed";
        rec.finishedAt = now;
        rec.error = "Build abandoned (runner stopped responding)";
        rec.runnerId = undefined;
        rec.logs.push(`⚠️ Build abandoned after ${Math.round((now - lastActive) / 60)}m with no runner activity`);
        jobs.set(rec.id, rec);
      }
    }
  }
}

function markStuckJobsInternal(): void {
  const now = Date.now();
  for (const rec of jobs.values()) {
    if (rec.status !== "queued" && rec.status !== "running") continue;
    const started = rec.startedAt ?? rec.createdAt;
    if (now - started <= STUCK_JOB_MS) continue;
    const wasQueued = rec.status === "queued";
    rec.status = "failed";
    rec.finishedAt = now;
    rec.error = "Build timed out - Mac runner may be offline";
    rec.runnerId = undefined;
    rec.logs.push(`Job ${rec.id} timed out after 10 minutes - marking as failed`);
    jobs.set(rec.id, rec);
    if (wasQueued) {
      const idx = queue.indexOf(rec.id);
      if (idx >= 0) queue.splice(idx, 1);
    }
    console.warn(`[buildJobs] Job ${rec.id} timed out after 10 minutes - marking as failed`);
  }
}

export function markStuckJobs(): void {
  markStuckJobsInternal();
}

export function claimNextBuildJob(runnerId: string): BuildJobRecord | undefined {
  markAbandonedJobs();

  while (queue.length > 0) {
    const id = queue.shift()!;
    const rec = jobs.get(id);
    if (!rec) continue;
    if (rec.status !== "queued") continue;
    rec.status = "running";
    rec.startedAt = Date.now();
    rec.lastActivityAt = Date.now();
    rec.runnerId = runnerId;
    jobs.set(id, rec);
    return rec;
  }
  return undefined;
}

