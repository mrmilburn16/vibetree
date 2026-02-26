import { NextResponse } from "next/server";
import { getProjectFiles, getProjectFilePaths } from "@/lib/projectFileStore";

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
