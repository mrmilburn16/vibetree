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
import { hasActiveSubscription } from "@/lib/subscriptionFirestore";

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
    disabled: project.disabled ?? false,
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
  if (updates.projectType === "pro") {
    const allowed = await hasActiveSubscription(auth.user.uid);
    if (!allowed) {
      return NextResponse.json(
        { error: "Pro plan requires an active subscription. Subscribe at /pricing." },
        { status: 403 }
      );
    }
  }
  const project = updateProject(id, updates);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  try {
    const ok = await updateProjectInFirestore(id, updates, auth.user.uid);
    if (!ok) {
      return NextResponse.json(
        { error: "Project could not be updated. Please try again." },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Project could not be updated. Please try again." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ...project, projectType: project?.projectType ?? "pro" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) return auth;
  const existed = getProject(id) != null;
  if (!existed) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  try {
    const ok = await deleteProjectFromFirestore(id, auth.user.uid);
    if (!ok) {
      return NextResponse.json(
        { error: "Project could not be deleted. Please try again." },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Project could not be deleted. Please try again." },
      { status: 503 }
    );
  }
  deleteProject(id);
  return new NextResponse(null, { status: 204 });
}
