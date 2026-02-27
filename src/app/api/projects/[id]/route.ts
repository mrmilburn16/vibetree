import { NextResponse } from "next/server";
import { getProject, updateProject, deleteProject, uniquifyProjectName } from "@/lib/projectStore";
import { getProjectFilePaths } from "@/lib/projectFileStore";
import { updateProjectInFirestore, deleteProjectFromFirestore } from "@/lib/projectsFirestore";

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
  return NextResponse.json({
    ...project,
    projectType: project.projectType ?? "pro",
    fileCount: filePaths.length,
    filePaths,
  });
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
  const updates: { name?: string; bundleId?: string; projectType?: "standard" | "pro" } = {};
  if (typeof body.name === "string") updates.name = uniquifyProjectName(id, body.name.trim());
  if (typeof body.bundleId === "string") updates.bundleId = body.bundleId;
  if (body.projectType === "standard" || body.projectType === "pro") updates.projectType = body.projectType;
  const project = updateProject(id, updates);
  if (project) await updateProjectInFirestore(id, updates);
  return NextResponse.json({ ...project, projectType: project?.projectType ?? "pro" });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existed = deleteProject(id);
  await deleteProjectFromFirestore(id);
  if (!existed) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
