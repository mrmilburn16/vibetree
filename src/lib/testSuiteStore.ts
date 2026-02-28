/**
 * Test suite runs persistence via Firestore (collection: test_suite_runs).
 * All exported functions are async and return Promises; callers must await.
 * visionTestReport.screenshots in each result are stripped before writing to stay under the 1MB document limit.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "test_suite_runs";

export type TestSuiteResult = {
  title: string;
  category: string;
  compiled: boolean;
  attempts: number;
  durationMs: number;
  projectId?: string;
  buildResultId?: string;
  errors: string[];
  fileCount: number;
  model?: string;
  /** Pasted Xcode runtime logs for Cursor analyze & fix. */
  runtimeLogs?: string;
  /** Optional; when present, screenshots are stripped before Firestore write. */
  visionTestReport?: {
    screenshots?: string[];
    [key: string]: unknown;
  };
};

export type TestSuiteRun = {
  id: string;
  timestamp: string;
  model: string;
  projectType: "pro";
  milestone?: string;
  status: "running" | "completed" | "stopped";
  results: TestSuiteResult[];
  summary: {
    total: number;
    compiled: number;
    compileRate: number;
    avgAttempts: number;
    totalDurationMs: number;
  };
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

function generateId(): string {
  return `tsr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Strip visionTestReport.screenshots in every result before writing to Firestore (1MB limit). */
function stripScreenshotsInRun(run: TestSuiteRun): TestSuiteRun {
  if (!run.results?.length) return run;
  return {
    ...run,
    results: run.results.map((r) => {
      if (!r.visionTestReport || !Array.isArray(r.visionTestReport.screenshots)) return r;
      return {
        ...r,
        visionTestReport: { ...r.visionTestReport, screenshots: [] },
      };
    }),
  };
}

/** Build a Firestore-safe payload (strip screenshots from nested visionTestReport in each result). */
function toFirestorePayload(run: TestSuiteRun): Record<string, unknown> {
  const stripped = stripScreenshotsInRun(run);
  return {
    id: stripped.id,
    timestamp: stripped.timestamp,
    model: stripped.model,
    projectType: stripped.projectType,
    milestone: stripped.milestone ?? null,
    status: stripped.status,
    results: stripped.results,
    summary: stripped.summary,
  };
}

/** Map Firestore doc data back to TestSuiteRun. */
function fromFirestoreData(id: string, data: Record<string, unknown>): TestSuiteRun {
  const results = (Array.isArray(data.results) ? data.results : []) as TestSuiteResult[];
  return {
    id: (data.id as string) || id,
    timestamp: (data.timestamp as string) || new Date().toISOString(),
    model: (data.model as string) || "sonnet-4.6",
    projectType: "pro",
    milestone: data.milestone != null ? (data.milestone as string) : undefined,
    status: (data.status as TestSuiteRun["status"]) || "running",
    results,
    summary: (data.summary as TestSuiteRun["summary"]) ?? {
      total: 0,
      compiled: 0,
      compileRate: 0,
      avgAttempts: 0,
      totalDurationMs: 0,
    },
  };
}

export async function createTestSuiteRun(
  model: string,
  projectType: "pro" = "pro",
  milestone?: string,
): Promise<TestSuiteRun> {
  const run: TestSuiteRun = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    model,
    projectType,
    milestone,
    status: "running",
    results: [],
    summary: { total: 0, compiled: 0, compileRate: 0, avgAttempts: 0, totalDurationMs: 0 },
  };

  const db = getDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(run.id).set(toFirestorePayload(run));
    } catch (e) {
      console.error("[test-suite-runs] Firestore write failed:", e);
    }
  }

  return run;
}

export async function getAllTestSuiteRuns(): Promise<TestSuiteRun[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(COLLECTION).orderBy("timestamp", "desc").get();
    return snap.docs.map((d) => fromFirestoreData(d.id, d.data()));
  } catch {
    return [];
  }
}

export async function getTestSuiteRun(id: string): Promise<TestSuiteRun | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return fromFirestoreData(doc.id, doc.data()!);
  } catch {
    return null;
  }
}

export async function updateTestSuiteRun(
  id: string,
  updates: Partial<Pick<TestSuiteRun, "status" | "results" | "summary">>,
): Promise<TestSuiteRun | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;

    const existing = fromFirestoreData(doc.id, doc.data()!);
    if (updates.status !== undefined) existing.status = updates.status;
    if (updates.results !== undefined) existing.results = updates.results;
    if (updates.summary !== undefined) existing.summary = updates.summary;

    await ref.set(toFirestorePayload(existing));
    return existing;
  } catch {
    return null;
  }
}

export async function getRunsByMilestone(milestone: string): Promise<TestSuiteRun[]> {
  const runs = await getAllTestSuiteRuns();
  return runs.filter((r) => r.milestone === milestone);
}
