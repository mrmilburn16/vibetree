/**
 * Build results persistence via Firestore (collection: build_results).
 * All exported functions are async and return Promises; callers must await.
 * visionTestReport.screenshots are stripped before writing to stay under the 1MB document limit.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";
import { recordBuildForSkill, addGoldenExample } from "@/lib/skills/registry";
import { getProjectFiles } from "@/lib/projectFileStore";
import { classifyNotes } from "@/lib/qa/issueClassifier";

const COLLECTION = "build_results";

/** Stored vision test report (persisted on build result). screenshots are not stored in Firestore. */
export type VisionTestReportStored = {
  projectId: string;
  appName: string;
  totalActions: number;
  duration: number;
  allIssues: string[];
  featuresTestedSuccessfully: string[];
  featuresThatCouldNotBeTested: string[];
  screenshots: string[];
  overallScore: number;
  recommendation: string;
  cursorPrompt: string;
  total_cost_usd?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  /** Issue type tags from every step (e.g. broken_button, keyboard_blocking). */
  issueTags?: string[];
};

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
  /** Full history of compiler errors per attempt (when available). */
  errorHistory?: Array<{ attempt: number; errors: string[] }>;
  /** Human-readable reason the build failed (e.g. "Max attempts (8) reached", "Auto-fix cancelled by user"). */
  errorMessage?: string | null;
  fileCount: number;
  fileNames: string[];
  durationMs: number;
  userNotes: string;
  userDesignScore: number | null;
  userFunctionalScore: number | null;
  /** Filename in data/build-results-images/ (e.g. br_xxx.png) for optional screenshot. */
  userImagePath: string | null;
  /** Skill IDs that were injected into the system prompt for this build. */
  skillsUsed: string[];
  /** Auto-classified issue tags derived from userNotes. */
  issueTags: string[];
  /** Claude vision test report (saved when vision test completes). */
  visionTestReport?: VisionTestReportStored | null;
  /** Estimated API cost in USD for the generation that produced this build (chat/stream). */
  generationCostUsd?: number | null;
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

/** Strip base64 screenshots from visionTestReport before writing to Firestore (1MB limit). */
function stripScreenshotsFromReport(
  report: VisionTestReportStored | null | undefined
): VisionTestReportStored | null | undefined {
  if (!report) return report;
  return {
    ...report,
    screenshots: [],
  };
}

/** Build a Firestore-safe payload (strip screenshots from nested report). */
function toFirestorePayload(result: BuildResult): Record<string, unknown> {
  const vision = result.visionTestReport;
  return {
    id: result.id,
    timestamp: result.timestamp,
    projectId: result.projectId,
    projectName: result.projectName,
    prompt: result.prompt,
    tier: result.tier,
    category: result.category,
    compiled: result.compiled,
    attempts: result.attempts,
    autoFixUsed: result.autoFixUsed,
    compilerErrors: result.compilerErrors,
    ...(Array.isArray(result.errorHistory) && result.errorHistory.length > 0 && { errorHistory: result.errorHistory }),
    ...(result.errorMessage != null && result.errorMessage !== "" && { errorMessage: result.errorMessage }),
    fileCount: result.fileCount,
    fileNames: result.fileNames,
    durationMs: result.durationMs,
    userNotes: result.userNotes ?? "",
    userDesignScore: result.userDesignScore,
    userFunctionalScore: result.userFunctionalScore,
    userImagePath: result.userImagePath,
    skillsUsed: result.skillsUsed ?? [],
    issueTags: result.issueTags ?? [],
    visionTestReport: vision ? stripScreenshotsFromReport(vision) ?? null : null,
    generationCostUsd: typeof result.generationCostUsd === "number" ? result.generationCostUsd : null,
  };
}

/** Map Firestore doc data back to BuildResult (screenshots will be [] when read from Firestore). */
function fromFirestoreData(id: string, data: Record<string, unknown>): BuildResult {
  const vision = data.visionTestReport as VisionTestReportStored | null | undefined;
  return {
    id: (data.id as string) || id,
    timestamp: (data.timestamp as string) || new Date().toISOString(),
    projectId: (data.projectId as string) || "",
    projectName: (data.projectName as string) || "",
    prompt: (data.prompt as string) || "",
    tier: (data.tier === "easy" || data.tier === "medium" || data.tier === "hard" || data.tier === "custom") ? data.tier : "custom",
    category: (data.category as string) || "",
    compiled: Boolean(data.compiled),
    attempts: typeof data.attempts === "number" ? data.attempts : 1,
    autoFixUsed: Boolean(data.autoFixUsed),
    compilerErrors: Array.isArray(data.compilerErrors) ? data.compilerErrors : [],
    errorHistory: Array.isArray(data.errorHistory)
      ? (data.errorHistory as Array<{ attempt: number; errors: string[] }>).filter(
          (e): e is { attempt: number; errors: string[] } =>
            typeof e?.attempt === "number" && Array.isArray(e?.errors)
        )
      : undefined,
    errorMessage: typeof data.errorMessage === "string" ? data.errorMessage : undefined,
    fileCount: typeof data.fileCount === "number" ? data.fileCount : 0,
    fileNames: Array.isArray(data.fileNames) ? data.fileNames : [],
    durationMs: typeof data.durationMs === "number" ? data.durationMs : 0,
    userNotes: typeof data.userNotes === "string" ? data.userNotes : "",
    userDesignScore: data.userDesignScore === null || (typeof data.userDesignScore === "number" && data.userDesignScore >= 1 && data.userDesignScore <= 5) ? data.userDesignScore as number | null : null,
    userFunctionalScore: data.userFunctionalScore === null || (typeof data.userFunctionalScore === "number" && data.userFunctionalScore >= 1 && data.userFunctionalScore <= 5) ? data.userFunctionalScore as number | null : null,
    userImagePath: data.userImagePath === null || (typeof data.userImagePath === "string") ? data.userImagePath as string | null : null,
    skillsUsed: Array.isArray(data.skillsUsed) ? data.skillsUsed : [],
    issueTags: Array.isArray(data.issueTags) ? data.issueTags : [],
    visionTestReport: vision && typeof vision === "object" ? { ...vision, screenshots: Array.isArray(vision.screenshots) ? vision.screenshots : [] } : null,
    generationCostUsd: typeof data.generationCostUsd === "number" ? data.generationCostUsd : null,
  };
}

function generateId(): string {
  return `br_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function logBuildResult(
  partial: Omit<BuildResult, "id" | "timestamp" | "userNotes" | "userDesignScore" | "userFunctionalScore" | "userImagePath" | "skillsUsed" | "issueTags"> & { skillsUsed?: string[]; issueTags?: string[] }
): Promise<BuildResult> {
  const result: BuildResult = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    userNotes: "",
    userDesignScore: null,
    userFunctionalScore: null,
    userImagePath: null,
    skillsUsed: [],
    issueTags: [],
    ...partial,
  };

  const db = getDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(result.id).set(toFirestorePayload(result));
    } catch (e) {
      console.error("[build-results] Firestore write failed:", e);
    }
  }

  for (const skillId of result.skillsUsed) {
    try {
      recordBuildForSkill(
        skillId,
        result.compiled,
        result.attempts === 1,
        null,
        result.compilerErrors,
      );
    } catch {
      // best-effort
    }
  }

  return result;
}

export async function getAllBuildResults(): Promise<BuildResult[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(COLLECTION).orderBy("timestamp", "desc").get();
    return snap.docs.map((d) => fromFirestoreData(d.id, d.data()));
  } catch {
    return [];
  }
}

export async function getBuildResult(id: string): Promise<BuildResult | null> {
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

export async function updateBuildResult(
  id: string,
  updates: {
    userNotes?: string;
    userDesignScore?: number | null;
    userFunctionalScore?: number | null;
    userImagePath?: string | null;
    issueTags?: string[];
    visionTestReport?: VisionTestReportStored | null;
  }
): Promise<BuildResult | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;

    const existing = fromFirestoreData(doc.id, doc.data()!);
    if (updates.userNotes !== undefined) {
      existing.userNotes = updates.userNotes;
      existing.issueTags = classifyNotes(updates.userNotes);
    }
    if (updates.issueTags !== undefined) existing.issueTags = updates.issueTags;
    if (updates.userDesignScore !== undefined) existing.userDesignScore = updates.userDesignScore;
    if (updates.userFunctionalScore !== undefined) existing.userFunctionalScore = updates.userFunctionalScore;
    if (updates.userImagePath !== undefined) existing.userImagePath = updates.userImagePath;
    if (updates.visionTestReport !== undefined) existing.visionTestReport = updates.visionTestReport;

    const payload = toFirestorePayload(existing);
    await ref.set(payload);

    if (updates.userFunctionalScore !== undefined && existing.skillsUsed?.length) {
      for (const skillId of existing.skillsUsed) {
        try {
          recordBuildForSkill(
            skillId,
            existing.compiled,
            existing.attempts === 1,
            updates.userFunctionalScore,
            [],
          );
        } catch {
          // best-effort
        }
      }
    }

    if (
      existing.compiled &&
      existing.attempts === 1 &&
      updates.userFunctionalScore != null &&
      updates.userFunctionalScore >= 4
    ) {
      try {
        const projFiles = getProjectFiles(existing.projectId);
        if (projFiles && Object.keys(projFiles).length > 0) {
          for (const skillId of existing.skillsUsed) {
            addGoldenExample(skillId, existing.id, projFiles);
          }
        }
      } catch {
        // best-effort
      }
    }

    return existing;
  } catch {
    return null;
  }
}

export async function getBuildStats(): Promise<{
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
}> {
  const results = await getAllBuildResults();
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
  const designScores: number[] = [];
  const funcScores: number[] = [];

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
