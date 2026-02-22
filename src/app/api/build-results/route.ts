import { logBuildResult, getAllBuildResults, getBuildStats } from "@/lib/buildResultsLog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("stats") === "true") {
    return Response.json(getBuildStats());
  }
  const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
  const results = getAllBuildResults().slice(0, limit);
  return Response.json({ results, total: results.length });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = logBuildResult({
    projectId: String(body.projectId ?? ""),
    projectName: String(body.projectName ?? "Unknown"),
    prompt: String(body.prompt ?? ""),
    tier: ["easy", "medium", "hard", "custom"].includes(body.tier) ? body.tier : "custom",
    category: String(body.category ?? ""),
    compiled: Boolean(body.compiled),
    attempts: typeof body.attempts === "number" ? body.attempts : 1,
    autoFixUsed: Boolean(body.autoFixUsed),
    compilerErrors: Array.isArray(body.compilerErrors) ? body.compilerErrors : [],
    fileCount: typeof body.fileCount === "number" ? body.fileCount : 0,
    fileNames: Array.isArray(body.fileNames) ? body.fileNames : [],
    durationMs: typeof body.durationMs === "number" ? body.durationMs : 0,
  });
  return Response.json({ result });
}
