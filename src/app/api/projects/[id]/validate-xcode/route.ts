import { getProject, ensureProject } from "@/lib/projectStore";
import { createBuildJob } from "@/lib/buildJobs";

type SwiftFile = { path: string; content: string };

function isValidBundleId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);
}

function sanitizeXcodeName(name: string, fallback: string): string {
  const raw = (name || "").trim();
  if (!raw || raw.toLowerCase() === "untitled app") return fallback;
  const cleaned = raw.replace(/[^\p{L}\p{N}\s-]+/gu, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  let joined = parts.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1)).join("");
  joined = joined.replace(/[^A-Za-z0-9]/g, "");
  if (!joined) return fallback;
  if (!/^[A-Za-z]/.test(joined)) joined = `Vibetree${joined}`;
  return joined.slice(0, 32);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const providedName = typeof body?.projectName === "string" ? body.projectName : "";
  const providedBundleId = typeof body?.bundleId === "string" ? body.bundleId : "";
  const providedTeam = typeof body?.developmentTeam === "string" ? body.developmentTeam : "";
  const files = Array.isArray(body?.files) ? (body.files as SwiftFile[]) : undefined;

  const project = getProject(projectId) ?? ensureProject(projectId, providedName || "Untitled app");
  const projectName = sanitizeXcodeName(providedName || project.name, "VibetreeApp");
  const candidateBundleId = (providedBundleId || project.bundleId || "com.vibetree.app").trim();
  const bundleId = isValidBundleId(candidateBundleId) ? candidateBundleId : "com.vibetree.app";

  const autoFix = body?.autoFix !== false;

  const job = createBuildJob({
    projectId,
    projectName,
    bundleId,
    ...(files ? { files } : {}),
    ...(providedTeam ? { developmentTeam: providedTeam } : {}),
    autoFix,
    attempt: 1,
    maxAttempts: 3,
  });

  return Response.json({ job });
}

