import { NextResponse } from "next/server";
import { getProject, setProject, type ProjectRecord } from "@/lib/projectStore";
import { getProjectFiles, getProjectFilePaths, setProjectFiles } from "@/lib/projectFileStore";
import { createBuildJob } from "@/lib/buildJobs";
import { isRunnerOnline } from "@/lib/runnerStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

function toRecord(doc: { id: string; name: string; bundleId: string; projectType: "standard" | "pro"; createdAt: number; updatedAt: number }): ProjectRecord {
  return { id: doc.id, name: doc.name, bundleId: doc.bundleId, projectType: doc.projectType, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

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
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;
  setProject(toRecord(auth.project));
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

  const project = getProject(projectId)!;

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

  if (files.length > 0) {
    setProjectFiles(projectId, files);
  }

  if (files.length === 0) {
    console.warn(
      `[build-install] No files for project ${projectId} (client sent ${clientFiles.length} files; server store had ${getProjectFilePaths(projectId).length} paths)`
    );
    return Response.json(
      {
        error:
          "No files to build. Use the Xcode button to download the project, open it in Xcode, select your iPhone, and run (⌘R). Or re-run this app once in the test suite so files are saved, then try Run on iPhone again.",
      },
      { status: 400 }
    );
  }

  if (!isRunnerOnline()) {
    return Response.json(
      {
        error: "mac_runner_offline",
        message: "The build server is currently offline. Please try again in a moment.",
      },
      { status: 503 }
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
