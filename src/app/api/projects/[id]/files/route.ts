import { NextResponse } from "next/server";
import { getProjectFiles, getProjectFilePaths, setProjectFiles } from "@/lib/projectFileStore";

/**
 * GET /api/projects/[id]/files
 * Returns project file contents as JSON for clients that didn't receive
 * projectFiles in the stream "done" event (e.g. iOS to avoid huge payloads).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

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
