import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/projectStore";
import { getProjectFilePaths } from "@/lib/projectFileStore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const filePaths = getProjectFilePaths(id);
  return NextResponse.json({ ...project, fileCount: filePaths.length, filePaths });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = getProject(id);
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const updates: { name?: string; bundleId?: string } = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.bundleId === "string") updates.bundleId = body.bundleId;
  const project = updateProject(id, updates);
  return NextResponse.json(project);
}
