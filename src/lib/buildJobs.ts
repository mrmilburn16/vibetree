export type BuildJobStatus = "queued" | "running" | "succeeded" | "failed";

export type BuildJobCreateRequest = {
  projectId: string;
  projectName: string;
  bundleId: string;
  /**
   * Optional: provide files so validation works even if server memory is cleared.
   * Shape matches the export-xcode POST body.
   */
  files?: Array<{ path: string; content: string }>;
  /** Optional: forwarded to export-xcode to embed DEVELOPMENT_TEAM in pbxproj. */
  developmentTeam?: string;
};

export type BuildJobRecord = {
  id: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: BuildJobStatus;
  runnerId?: string;
  request: BuildJobCreateRequest;
  /** Last N log lines from the runner. */
  logs: string[];
  exitCode?: number;
  error?: string;
};

const MAX_LOG_LINES = 1500;

const jobs = new Map<string, BuildJobRecord>();
const queue: string[] = [];

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

export function appendBuildJobLogs(id: string, lines: string[]): void {
  const rec = jobs.get(id);
  if (!rec) return;
  rec.logs.push(...lines.filter((l) => typeof l === "string" && l.length > 0));
  if (rec.logs.length > MAX_LOG_LINES) {
    rec.logs = rec.logs.slice(rec.logs.length - MAX_LOG_LINES);
  }
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

/**
 * Claim the next queued job. Returns undefined if none.
 * Intended for a single runner or best-effort multi-runner.
 */
export function claimNextBuildJob(runnerId: string): BuildJobRecord | undefined {
  while (queue.length > 0) {
    const id = queue.shift()!;
    const rec = jobs.get(id);
    if (!rec) continue;
    if (rec.status !== "queued") continue;
    rec.status = "running";
    rec.startedAt = Date.now();
    rec.runnerId = runnerId;
    jobs.set(id, rec);
    return rec;
  }
  return undefined;
}

