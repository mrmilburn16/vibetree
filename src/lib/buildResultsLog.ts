import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const LOG_PATH = join(process.cwd(), "data", "build-results.jsonl");

export type BuildResult = {
  id: string;
  timestamp: string;
  projectId: string;
  projectName: string;
  prompt: string;
  tier: "easy" | "medium" | "hard" | "custom";
  category: string;
  compiled: boolean;
  attempts: number;
  autoFixUsed: boolean;
  compilerErrors: string[];
  fileCount: number;
  fileNames: string[];
  durationMs: number;
  userNotes: string;
  userDesignScore: number | null;
  userFunctionalScore: number | null;
  /** Filename in data/build-results-images/ (e.g. br_xxx.png) for optional screenshot. */
  userImagePath: string | null;
};

function generateId(): string {
  return `br_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function logBuildResult(
  partial: Omit<BuildResult, "id" | "timestamp" | "userNotes" | "userDesignScore" | "userFunctionalScore" | "userImagePath">
): BuildResult {
  const result: BuildResult = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    userNotes: "",
    userDesignScore: null,
    userFunctionalScore: null,
    userImagePath: null,
    ...partial,
  };
  try {
    const dir = dirname(LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(result) + "\n", "utf8");
  } catch (e) {
    console.error("[build-results] Failed to write:", e);
  }
  return result;
}

export function getAllBuildResults(): BuildResult[] {
  if (!existsSync(LOG_PATH)) return [];
  try {
    const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
    return lines.map((l) => {
      const r = JSON.parse(l) as BuildResult;
      if (r.userImagePath === undefined) r.userImagePath = null;
      return r;
    }).reverse();
  } catch {
    return [];
  }
}

export function getBuildResult(id: string): BuildResult | null {
  return getAllBuildResults().find((r) => r.id === id) ?? null;
}

export function updateBuildResult(
  id: string,
  updates: { userNotes?: string; userDesignScore?: number | null; userFunctionalScore?: number | null; userImagePath?: string | null }
): BuildResult | null {
  if (!existsSync(LOG_PATH)) return null;
  try {
    const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
    let found: BuildResult | null = null;
    const updated = lines.map((line) => {
      const r = JSON.parse(line) as BuildResult;
      if (r.id === id) {
        if (updates.userNotes !== undefined) r.userNotes = updates.userNotes;
        if (updates.userDesignScore !== undefined) r.userDesignScore = updates.userDesignScore;
        if (updates.userFunctionalScore !== undefined) r.userFunctionalScore = updates.userFunctionalScore;
        if (updates.userImagePath !== undefined) r.userImagePath = updates.userImagePath;
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

export function getBuildStats(): {
  total: number;
  compiled: number;
  failed: number;
  compileRate: number;
  byTier: Record<string, { total: number; compiled: number; rate: number }>;
  byCategory: Record<string, { total: number; compiled: number; rate: number }>;
  avgAttempts: number;
  autoFixRate: number;
  commonErrors: Array<{ error: string; count: number }>;
  avgDesignScore: number | null;
  avgFunctionalScore: number | null;
} {
  const results = getAllBuildResults();
  const total = results.length;
  if (total === 0) {
    return {
      total: 0, compiled: 0, failed: 0, compileRate: 0,
      byTier: {}, byCategory: {}, avgAttempts: 0, autoFixRate: 0,
      commonErrors: [], avgDesignScore: null, avgFunctionalScore: null,
    };
  }

  const compiled = results.filter((r) => r.compiled).length;
  const failed = total - compiled;

  const byTier: Record<string, { total: number; compiled: number; rate: number }> = {};
  const byCategory: Record<string, { total: number; compiled: number; rate: number }> = {};
  const errorCounts: Record<string, number> = {};

  let totalAttempts = 0;
  let autoFixCount = 0;
  let designScores: number[] = [];
  let funcScores: number[] = [];

  for (const r of results) {
    totalAttempts += r.attempts;
    if (r.autoFixUsed) autoFixCount++;
    if (r.userDesignScore !== null) designScores.push(r.userDesignScore);
    if (r.userFunctionalScore !== null) funcScores.push(r.userFunctionalScore);

    if (!byTier[r.tier]) byTier[r.tier] = { total: 0, compiled: 0, rate: 0 };
    byTier[r.tier].total++;
    if (r.compiled) byTier[r.tier].compiled++;

    const cat = r.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, compiled: 0, rate: 0 };
    byCategory[cat].total++;
    if (r.compiled) byCategory[cat].compiled++;

    for (const e of r.compilerErrors) {
      const normalized = e.replace(/\S+\.swift:\d+(:\d+)?:\s*/, "").trim();
      if (normalized) errorCounts[normalized] = (errorCounts[normalized] || 0) + 1;
    }
  }

  for (const tier of Object.values(byTier)) tier.rate = Math.round((tier.compiled / tier.total) * 100);
  for (const cat of Object.values(byCategory)) cat.rate = Math.round((cat.compiled / cat.total) * 100);

  const commonErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([error, count]) => ({ error, count }));

  return {
    total, compiled, failed,
    compileRate: Math.round((compiled / total) * 100),
    byTier, byCategory,
    avgAttempts: Math.round((totalAttempts / total) * 10) / 10,
    autoFixRate: Math.round((autoFixCount / total) * 100),
    commonErrors,
    avgDesignScore: designScores.length > 0 ? Math.round((designScores.reduce((a, b) => a + b, 0) / designScores.length) * 10) / 10 : null,
    avgFunctionalScore: funcScores.length > 0 ? Math.round((funcScores.reduce((a, b) => a + b, 0) / funcScores.length) * 10) / 10 : null,
  };
}
