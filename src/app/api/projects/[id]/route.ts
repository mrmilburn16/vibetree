import { NextResponse } from "next/server";
import {
  getProject,
  setProject,
  updateProject,
  deleteProject,
  uniquifyProjectName,
  type ProjectRecord,
} from "@/lib/projectStore";
import { getProjectFilePaths } from "@/lib/projectFileStore";
import { updateProjectInFirestore, deleteProjectFromFirestore } from "@/lib/projectsFirestore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

function toRecord(doc: { id: string; name: string; bundleId: string; projectType: "standard" | "pro"; createdAt: number; updatedAt: number }): ProjectRecord {
  return { id: doc.id, name: doc.name, bundleId: doc.bundleId, projectType: doc.projectType, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) return auth;
  const { project } = auth;
  setProject(toRecord(project));
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
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) return auth;
  setProject(toRecord(auth.project));
  const body = await request.json().catch(() => ({}));
  const updates: { name?: string; bundleId?: string; projectType?: "standard" | "pro" } = {};
  if (typeof body.name === "string") updates.name = uniquifyProjectName(id, body.name.trim());
  if (typeof body.bundleId === "string") updates.bundleId = body.bundleId;
  if (body.projectType === "standard" || body.projectType === "pro") updates.projectType = body.projectType;
  const project = updateProject(id, updates);
  if (project) await updateProjectInFirestore(id, updates, auth.user.uid);
  return NextResponse.json({ ...project, projectType: project?.projectType ?? "pro" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) return auth;
  const existed = deleteProject(id);
  await deleteProjectFromFirestore(id, auth.user.uid);
  if (!existed) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
