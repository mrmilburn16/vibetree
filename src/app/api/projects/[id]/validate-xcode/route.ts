import { getProject, ensureProject } from "@/lib/projectStore";
import { createBuildJob } from "@/lib/buildJobs";

type SwiftFile = { path: string; content: string };

function isValidBundleId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);
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
  const projectName = (providedName || project.name || "VibetreeApp").trim() || "VibetreeApp";
  const candidateBundleId = (providedBundleId || project.bundleId || "com.vibetree.app").trim();
  const bundleId = isValidBundleId(candidateBundleId) ? candidateBundleId : "com.vibetree.app";

  const job = createBuildJob({
    projectId,
    projectName,
    bundleId,
    ...(files ? { files } : {}),
    ...(providedTeam ? { developmentTeam: providedTeam } : {}),
  });

  return Response.json({ job });
}

