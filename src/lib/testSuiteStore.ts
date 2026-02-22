import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const LOG_PATH = join(process.cwd(), "data", "test-suite-runs.jsonl");

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
};

export type TestSuiteRun = {
  id: string;
  timestamp: string;
  model: string;
  projectType: "pro";
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

function generateId(): string {
  return `tsr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createTestSuiteRun(
  model: string,
  projectType: "pro" = "pro",
): TestSuiteRun {
  const run: TestSuiteRun = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    model,
    projectType,
    status: "running",
    results: [],
    summary: { total: 0, compiled: 0, compileRate: 0, avgAttempts: 0, totalDurationMs: 0 },
  };
  const dir = dirname(LOG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify(run) + "\n", "utf8");
  return run;
}

export function getAllTestSuiteRuns(): TestSuiteRun[] {
  if (!existsSync(LOG_PATH)) return [];
  try {
    const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
    return lines.map((l) => JSON.parse(l) as TestSuiteRun).reverse();
  } catch {
    return [];
  }
}

export function getTestSuiteRun(id: string): TestSuiteRun | null {
  return getAllTestSuiteRuns().find((r) => r.id === id) ?? null;
}

export function updateTestSuiteRun(
  id: string,
  updates: Partial<Pick<TestSuiteRun, "status" | "results" | "summary">>,
): TestSuiteRun | null {
  if (!existsSync(LOG_PATH)) return null;
  try {
    const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
    let found: TestSuiteRun | null = null;
    const updated = lines.map((line) => {
      const r = JSON.parse(line) as TestSuiteRun;
      if (r.id === id) {
        if (updates.status !== undefined) r.status = updates.status;
        if (updates.results !== undefined) r.results = updates.results;
        if (updates.summary !== undefined) r.summary = updates.summary;
        found = r;
      }
      return JSON.stringify(r);
    });
    if (found) writeFileSync(LOG_PATH, updated.join("\n") + "\n", "utf8");
    return found;
  } catch {
    return null;
  }
}
