import { getProject, ensureProject } from "@/lib/projectStore";
import { createBuildJob } from "@/lib/buildJobs";

type SwiftFile = { path: string; content: string };

function isValidBundleId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);
}

function normalizeSwiftFiles(filesRaw: SwiftFile[]): SwiftFile[] {
  const nonEmpty = filesRaw.filter((f) => typeof f?.path === "string" && (f.content ?? "").trim().length > 0);
  const byBase = new Map<string, SwiftFile[]>();
  for (const f of nonEmpty) {
    const base = (f.path.split("/").pop() ?? f.path).trim();
    const arr = byBase.get(base) ?? [];
    arr.push(f);
    byBase.set(base, arr);
  }
  const out: SwiftFile[] = [];
  for (const [, group] of byBase.entries()) {
    const preferred =
      group.find((f) => f.path.startsWith("VibetreeApp/")) ??
      group.find((f) => f.path.includes("/VibetreeApp/")) ??
      group[0];
    const path = preferred.path.trim() || preferred.path.split("/").pop();
    out.push({ ...preferred, path: path ?? "file.swift" });
  }
  return out;
}

/**
 * POST /api/projects/[id]/build-run
 * Creates a build job with outputType: "run" — build for physical device, install, and launch.
 * Requires deviceUdid and developmentTeam. Mac runner must have the device connected.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const deviceUdid = typeof body?.deviceUdid === "string" ? body.deviceUdid.trim() : "";
  const providedTeam = typeof body?.developmentTeam === "string" ? body.developmentTeam.trim() : "";
  const providedName = typeof body?.projectName === "string" ? body.projectName : "";
  const providedBundleId = typeof body?.bundleId === "string" ? body.bundleId : "";
  const filesRaw = Array.isArray(body?.files) ? (body.files as SwiftFile[]) : undefined;

  if (!deviceUdid) {
    return Response.json({ error: "deviceUdid is required for Build & Run on device" }, { status: 400 });
  }
  if (!providedTeam) {
    return Response.json(
      { error: "Team ID is required for device builds. Set it in Advanced settings." },
      { status: 400 }
    );
  }

  const project = getProject(projectId) ?? ensureProject(projectId, providedName || "Untitled app");
  const candidateBundleId = (providedBundleId || project.bundleId || "com.vibetree.app").trim();
  const bundleId = isValidBundleId(candidateBundleId) ? candidateBundleId : "com.vibetree.app";
  const files = filesRaw ? normalizeSwiftFiles(filesRaw) : undefined;

  const job = createBuildJob({
    projectId,
    projectName: project.name || providedName || "Untitled app",
    bundleId,
    developmentTeam: providedTeam,
    ...(files && files.length > 0 ? { files } : {}),
    autoFix: body?.autoFix !== false,
    attempt: 1,
    maxAttempts: 8,
    outputType: "run",
    deviceUdid,
  });

  return Response.json({ job });
}
