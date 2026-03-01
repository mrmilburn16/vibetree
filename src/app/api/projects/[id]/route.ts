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
import { getProjectFromFirestore, updateProjectInFirestore, deleteProjectFromFirestore } from "@/lib/projectsFirestore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let project = getProject(id);
  if (!project) {
    const fromFirestoreDoc = await getProjectFromFirestore(id);
    if (!fromFirestoreDoc) {
      console.log(`[projects][GET] ${id} not in memory or Firestore → 404`);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    setProject(fromFirestoreDoc as ProjectRecord);
    project = fromFirestoreDoc as ProjectRecord;
    console.log(`[projects][GET] ${id} loaded from Firestore (deep link / single-fetch)`);
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
