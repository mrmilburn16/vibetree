import { NextResponse } from "next/server";
import { setProject, type ProjectRecord } from "@/lib/projectStore";
import { getProjectFiles, getProjectFilePaths, setProjectFiles } from "@/lib/projectFileStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

function toRecord(doc: { id: string; name: string; bundleId: string; projectType: "standard" | "pro"; createdAt: number; updatedAt: number }): ProjectRecord {
  return { id: doc.id, name: doc.name, bundleId: doc.bundleId, projectType: doc.projectType, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

/**
 * GET /api/projects/[id]/files
 * Returns project file contents as JSON for clients that didn't receive
 * projectFiles in the stream "done" event (e.g. iOS to avoid huge payloads).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) return auth;
  setProject(toRecord(auth.project));
  const paths = getProjectFilePaths(id);
  const filesMap = getProjectFiles(id);
  if (!filesMap || paths.length === 0) {
    return NextResponse.json({ files: [] });
  }

  const files = paths.map((path) => ({
    path,
    content: filesMap[path] ?? "",
  }));
  return NextResponse.json({ files });
}

/**
 * POST /api/projects/[id]/files
 * Saves project files to the server so build-install and GET /files can use them
 * (e.g. test-suite syncing after a successful build).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) return auth;
  setProject(toRecord(auth.project));
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const files = Array.isArray(body?.files)
    ? (body.files as { path: string; content: string }[]).filter(
        (f) => typeof f.path === "string" && typeof f.content === "string"
      )
    : [];
  if (files.length === 0) {
    return NextResponse.json({ error: "No valid files in body" }, { status: 400 });
  }

  setProjectFiles(id, files);
  return NextResponse.json({ ok: true });
}
