import { NextResponse } from "next/server";
import { getProject, setProject, type ProjectRecord } from "@/lib/projectStore";
import { getProjectFiles, getProjectFilesAsync, getProjectFilePaths, setProjectFiles } from "@/lib/projectFileStore";
import { createBuildJob } from "@/lib/buildJobs";
import { isRunnerOnline } from "@/lib/runnerStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";
import { hasActiveSubscription } from "@/lib/subscriptionFirestore";
import { getDevelopmentTeamId } from "@/lib/userDevelopmentTeamFirestore";

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
  if (auth.project.projectType === "pro") {
    const allowed = await hasActiveSubscription(auth.user.uid);
    if (!allowed) {
      return Response.json(
        { error: "Run on device requires an active subscription. Subscribe at /pricing." },
        { status: 403 }
      );
    }
  }
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
  const userTeamId = await getDevelopmentTeamId(auth.user.uid);
  const developmentTeam =
    providedTeam || userTeamId || process.env.DEFAULT_DEVELOPMENT_TEAM || "";

  // Temporary: verify team resolution order — remove after debugging
  console.log("[build-install] team resolution:", {
    "1_body.developmentTeam": providedTeam || "(empty)",
    "2_Firestore_getDevelopmentTeamId(userId)": userTeamId ?? "(null)",
    "3_process.env.DEFAULT_DEVELOPMENT_TEAM": process.env.DEFAULT_DEVELOPMENT_TEAM ?? "(undefined)",
    "final_developmentTeam": developmentTeam || "(empty)",
  });

  const project = getProject(projectId)!;

  const candidateBundleId = (
    providedBundleId ||
    project.bundleId ||
    "com.vibetree.app"
  ).trim();
  const bundleId = isValidBundleId(candidateBundleId)
    ? candidateBundleId
    : "com.vibetree.app";

  if (!isRunnerOnline()) {
    return Response.json(
      {
        error: "mac_runner_offline",
        message: "The build server is currently offline. Please try again in a moment.",
      },
      { status: 503 }
    );
  }

  // useCache=true: install from the runner's local .app cache — no xcodebuild, no files needed.
  // This is used for re-installs after the first successful device build for the current code version.
  const useCache = body?.useCache === true;
  if (useCache) {
    console.log(`[build-install] useCache=true for project ${projectId} — creating install-from-cache job`);
    const job = createBuildJob({
      projectId,
      projectName: project.name || providedName || "Untitled app",
      bundleId,
      developmentTeam,
      autoFix: false,
      attempt: 1,
      maxAttempts: 0,
      outputType: "install-from-cache",
    });
    return Response.json({ job });
  }

  // Full compile path (first install for this code version).
  const clientFiles = Array.isArray(body?.files)
    ? (body.files as { path: string; content: string }[]).filter(
        (f) => typeof f.path === "string" && typeof f.content === "string"
      )
    : [];

  let files = clientFiles;
  if (files.length === 0) {
    const store = getProjectFiles(projectId) ?? await getProjectFilesAsync(projectId);
    if (store && Object.keys(store).length > 0) {
      files = Object.keys(store).map((p) => ({ path: p, content: store[p] ?? "" }));
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
          "No compiled build found. Build the app from chat first, then tap Install on iPhone.",
      },
      { status: 400 }
    );
  }

  // Install jobs NEVER auto-fix. Auto-fix belongs in the agent conversation only.
  // The code is already verified by the simulator build; this job just compiles for
  // device signing and installs via devicectl. One attempt, no retries.
  const job = createBuildJob({
    projectId,
    projectName: project.name || providedName || "Untitled app",
    bundleId,
    developmentTeam,
    autoFix: false,
    attempt: 1,
    maxAttempts: 0,
    outputType: "device",
    files,
  });

  return Response.json({ job });
}
