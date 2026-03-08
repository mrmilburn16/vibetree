import { NextResponse } from "next/server";
import { getProject, setProject, type ProjectRecord } from "@/lib/projectStore";
import { getProjectFilesAsync, setProjectFiles } from "@/lib/projectFileStore";
import { createBuildJob } from "@/lib/buildJobs";
import { isRunnerOnline } from "@/lib/runnerStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";
import { hasActiveSubscription } from "@/lib/subscriptionFirestore";

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

function normalizeSwiftFiles(files: SwiftFile[]): SwiftFile[] {
  // Remove empty placeholders and prevent duplicate basenames that can cause
  // "Multiple commands produce ... .stringsdata" failures.
  const nonEmpty = files.filter((f) => typeof f?.path === "string" && (f.content ?? "").trim().length > 0);

  const byBase = new Map<string, SwiftFile[]>();
  for (const f of nonEmpty) {
    const base = (f.path.split("/").pop() ?? f.path).trim();
    const arr = byBase.get(base) ?? [];
    arr.push(f);
    byBase.set(base, arr);
  }

  const out: SwiftFile[] = [];
  for (const [base, group] of byBase.entries()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }

    // Prefer canonical app paths.
    const preferred =
      group.find((f) => f.path.startsWith("VibetreeApp/")) ??
      group.find((f) => f.path.includes("/VibetreeApp/")) ??
      group[0];

    // If there are multiple non-empty variants, keep only one to avoid build-system conflicts.
    // (If they differ semantically, the compile step will surface missing symbols rather than
    // failing at the build system layer.)
    out.push({ ...preferred, path: preferred.path.trim() || base });
  }

  return out;
}

function toRecord(doc: { id: string; name: string; bundleId: string; projectType: "standard" | "pro"; createdAt: number; updatedAt: number }): ProjectRecord {
  return { id: doc.id, name: doc.name, bundleId: doc.bundleId, projectType: doc.projectType, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });
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
  const providedName = typeof body?.projectName === "string" ? body.projectName : "";
  const providedBundleId = typeof body?.bundleId === "string" ? body.bundleId : "";
  const providedTeam = typeof body?.developmentTeam === "string" && body.developmentTeam.trim()
    ? body.developmentTeam.trim()
    : process.env.DEFAULT_DEVELOPMENT_TEAM ?? "";
  const filesRaw = Array.isArray(body?.files) ? (body.files as SwiftFile[]) : undefined;
  let files: SwiftFile[] | undefined = filesRaw ? normalizeSwiftFiles(filesRaw) : undefined;
  if (!files?.length) {
    const store = await getProjectFilesAsync(projectId);
    if (store && Object.keys(store).length > 0) {
      files = Object.keys(store).map((p) => ({ path: p, content: store[p] ?? "" }));
    }
  }
  const userPrompt = typeof body?.userPrompt === "string" ? body.userPrompt : undefined;

  const project = getProject(projectId)!;
  const candidateBundleId = (providedBundleId || project.bundleId || "com.vibetree.app").trim();
  const bundleId = isValidBundleId(candidateBundleId) ? candidateBundleId : "com.vibetree.app";

  const autoFix = body?.autoFix !== false;

  if (files?.length) {
    setProjectFiles(projectId, files);
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
    ...(files?.length ? { files } : {}),
    ...(providedTeam ? { developmentTeam: providedTeam } : {}),
    ...(userPrompt ? { userPrompt } : {}),
    autoFix,
    attempt: 1,
    maxAttempts: 8,
  });

  return Response.json({ job });
}

