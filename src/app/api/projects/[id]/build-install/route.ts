import { getProject, ensureProject } from "@/lib/projectStore";
import { createBuildJob } from "@/lib/buildJobs";

function isValidBundleId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);
}

/**
 * POST /api/projects/[id]/build-install
 * Creates a build job with outputType: "ipa" for on-device installation.
 * The mac-runner will archive, export a signed IPA, and upload it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) {
    return Response.json({ error: "Project ID required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const providedName =
    typeof body?.projectName === "string" ? body.projectName : "";
  const providedBundleId =
    typeof body?.bundleId === "string" ? body.bundleId : "";
  const providedTeam =
    typeof body?.developmentTeam === "string" ? body.developmentTeam : "";

  const project =
    getProject(projectId) ??
    ensureProject(projectId, providedName || "Untitled app");

  const candidateBundleId = (
    providedBundleId ||
    project.bundleId ||
    "com.vibetree.app"
  ).trim();
  const bundleId = isValidBundleId(candidateBundleId)
    ? candidateBundleId
    : "com.vibetree.app";

  const job = createBuildJob({
    projectId,
    projectName: project.name || providedName || "Untitled app",
    bundleId,
    ...(providedTeam ? { developmentTeam: providedTeam } : {}),
    autoFix: body?.autoFix !== false,
    attempt: 1,
    maxAttempts: 8,
    outputType: "ipa",
  });

  return Response.json({ job });
}
