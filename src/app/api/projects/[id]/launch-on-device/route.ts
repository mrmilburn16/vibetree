import { NextResponse } from "next/server";
import { createBuildJob } from "@/lib/buildJobs";
import { isRunnerOnline } from "@/lib/runnerStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

/**
 * POST /api/projects/[id]/launch-on-device
 * Creates a launch-only job: Mac runner runs devicectl device process launch
 * (no build, no install). Used when app was installed but auto-launch failed (e.g. device locked).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;

  const project = auth.project;
  const bundleId = (project.bundleId || "com.vibetree.app").trim();
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(bundleId)) {
    return NextResponse.json({ error: "Invalid bundle ID" }, { status: 400 });
  }

  if (!isRunnerOnline()) {
    return NextResponse.json(
      {
        error: "mac_runner_offline",
        message: "The build server is currently offline. Please try again in a moment.",
      },
      { status: 503 }
    );
  }

  const job = createBuildJob({
    projectId,
    projectName: project.name || "Untitled app",
    bundleId,
    outputType: "launch",
  });

  return Response.json({ job });
}
