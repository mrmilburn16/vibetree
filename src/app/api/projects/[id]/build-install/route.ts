import { getProject, ensureProject } from "@/lib/projectStore";
import { getProjectFiles, getProjectFilePaths } from "@/lib/projectFileStore";
import { createBuildJob } from "@/lib/buildJobs";

function isValidBundleId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);
}

/**
 * POST /api/projects/[id]/build-install
 * Builds for real device with code signing, then installs via devicectl.
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
    typeof body?.developmentTeam === "string"
      ? body.developmentTeam.trim()
      : "";
  const developmentTeam =
    providedTeam || process.env.DEFAULT_DEVELOPMENT_TEAM || "";

  const clientFiles = Array.isArray(body?.files)
    ? (body.files as { path: string; content: string }[]).filter(
        (f) => typeof f.path === "string" && typeof f.content === "string"
      )
    : [];

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

  let files = clientFiles;
  if (files.length === 0) {
    const paths = getProjectFilePaths(projectId);
    const store = getProjectFiles(projectId);
    if (paths.length > 0 && store) {
      files = paths.map((p) => ({ path: p, content: store[p] ?? "" }));
    }
  }

  if (files.length === 0) {
    console.warn(
      `[build-install] No files for project ${projectId} (client sent ${clientFiles.length} files; server store had ${getProjectFilePaths(projectId).length} paths)`
    );
    return Response.json(
      {
        error:
          "No files to build. Send a message first to generate your app, then try Install on Device again.",
      },
      { status: 400 }
    );
  }

  const job = createBuildJob({
    projectId,
    projectName: project.name || providedName || "Untitled app",
    bundleId,
    developmentTeam,
    autoFix: body?.autoFix !== false,
    attempt: 1,
    maxAttempts: 8,
    outputType: "device",
    files,
  });

  return Response.json({ job });
}
