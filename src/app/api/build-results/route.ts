import { logBuildResult, getAllBuildResults, getBuildStats, computeStatsFromResults } from "@/lib/buildResultsLog";

/** Parse date range: today, 7d, 30d, or ISO string for since. */
function parseSince(range: string | null): string | undefined {
  if (!range) return undefined;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (range === "today") return todayStart;
  if (range === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (range === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  if (range === "all") return undefined;
  return range;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const since = parseSince(url.searchParams.get("since") ?? null);
  const wantStats = url.searchParams.get("stats") === "true";
  const limitParam = url.searchParams.get("limit");
  const parsed = limitParam != null ? parseInt(limitParam, 10) : 100;
  const safeLimit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 100;

  // Single-query path: client asks for list + stats (e.g. ?limit=200&stats=true). One Firestore query, then compute stats from same docs.
  if (wantStats && safeLimit >= 1) {
    const results = await getAllBuildResults({ since, limit: safeLimit });
    const stats = computeStatsFromResults(results);
    return Response.json({ results, total: results.length, stats });
  }

  // Stats-only (no limit or legacy call): one query with capped limit
  if (wantStats) {
    return Response.json(await getBuildStats({ since }));
  }

  const results = await getAllBuildResults({ since, limit: safeLimit });
  return Response.json({ results, total: results.length });
}

/** Extract Swift filenames referenced in compiler error lines (e.g. "AppState.swift:85:69" -> "AppState.swift"). */
function errorFileNames(
  compilerErrors: string[],
  errorHistory?: Array<{ attempt: number; errors: string[] }>
): Set<string> {
  const names = new Set<string>();
  const addFrom = (lines: string[]) => {
    for (const line of lines) {
      const m = line.match(/([^\s:]+\.swift):\d+/);
      if (m) names.add(m[1]);
    }
  };
  addFrom(compilerErrors);
  if (Array.isArray(errorHistory)) for (const e of errorHistory) addFrom(e.errors ?? []);
  return names;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const compilerErrors = Array.isArray(body.compilerErrors) ? body.compilerErrors : [];
  const errorHistory = Array.isArray(body.errorHistory) &&
    body.errorHistory.every(
      (e: unknown) =>
        typeof e === "object" && e !== null && "attempt" in e && "errors" in e &&
        typeof (e as { attempt: unknown }).attempt === "number" &&
        Array.isArray((e as { errors: unknown }).errors)
    )
    ? (body.errorHistory as Array<{ attempt: number; errors: string[] }>)
    : undefined;
  const wanted = errorFileNames(compilerErrors, errorHistory);
  let sourceFiles: Record<string, string> | undefined;
  if (Array.isArray(body.sourceFiles) && body.sourceFiles.length > 0) {
    const record: Record<string, string> = {};
    for (const f of body.sourceFiles) {
      if (f && typeof f.path === "string" && typeof f.content === "string") record[f.path] = f.content;
    }
    if (wanted.size > 0 && Object.keys(record).length > 0) {
      sourceFiles = {};
      for (const [path, content] of Object.entries(record)) {
        const base = path.split("/").pop() ?? path;
        if (wanted.has(base) || wanted.has(path)) sourceFiles[path] = content;
      }
    }
  } else if (body.sourceFiles && typeof body.sourceFiles === "object" && !Array.isArray(body.sourceFiles)) {
    const record = body.sourceFiles as Record<string, string>;
    if (wanted.size > 0) {
      sourceFiles = {};
      for (const [path, content] of Object.entries(record)) {
        if (typeof content !== "string") continue;
        const base = path.split("/").pop() ?? path;
        if (wanted.has(base) || wanted.has(path)) sourceFiles[path] = content;
      }
    }
  }
  const result = await logBuildResult({
    projectId: String(body.projectId ?? ""),
    projectName: String(body.projectName ?? "Unknown"),
    prompt: String(body.prompt ?? ""),
    tier: ["easy", "medium", "hard", "custom"].includes(body.tier) ? body.tier : "custom",
    category: String(body.category ?? ""),
    compiled: Boolean(body.compiled),
    attempts: typeof body.attempts === "number" ? body.attempts : 1,
    autoFixUsed: Boolean(body.autoFixUsed),
    compilerErrors,
    fileCount: typeof body.fileCount === "number" ? body.fileCount : 0,
    fileNames: Array.isArray(body.fileNames) ? body.fileNames : [],
    durationMs: typeof body.durationMs === "number" ? body.durationMs : 0,
    skillsUsed: Array.isArray(body.skillsUsed) ? body.skillsUsed : [],
    ...(typeof body.generationCostUsd === "number" && body.generationCostUsd >= 0 && { generationCostUsd: body.generationCostUsd }),
    ...(errorHistory && errorHistory.length > 0 && { errorHistory }),
    ...(typeof body.errorMessage === "string" && body.errorMessage.trim() !== "" && { errorMessage: body.errorMessage.trim() }),
    ...(sourceFiles && Object.keys(sourceFiles).length > 0 && { sourceFiles }),
  });
  return Response.json({ result });
}
