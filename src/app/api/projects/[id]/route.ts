import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/projectStore";
import {
  getProjectFirestore,
  updateProjectFirestore,
  deleteProjectFirestore,
} from "@/lib/projectStoreFirestore";
import { getAuthUserIdFromRequest, isFirestoreConfigured } from "@/lib/authServer";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthUserIdFromRequest(request);
  if (userId && isFirestoreConfigured()) {
    try {
      const project = await getProjectFirestore(userId, id);
      if (project) return NextResponse.json(project);
    } catch (e) {
      console.error("[projects/:id] Firestore get failed:", e);
    }
  }
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthUserIdFromRequest(request);
  if (userId && isFirestoreConfigured()) {
    try {
      const body = await request.json().catch(() => ({}));
      const updates: { name?: string; bundleId?: string } = {};
      if (typeof body.name === "string") updates.name = body.name;
      if (typeof body.bundleId === "string") updates.bundleId = body.bundleId;
      const project = await updateProjectFirestore(userId, id, updates);
      if (project) {
        updateProject(id, updates);
        return NextResponse.json(project);
      }
    } catch (e) {
      console.error("[projects/:id] Firestore patch failed:", e);
    }
  }
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthUserIdFromRequest(request);
  if (userId && isFirestoreConfigured()) {
    try {
      const ok = await deleteProjectFirestore(userId, id);
      if (ok) return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[projects/:id] Firestore delete failed:", e);
    }
  }
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}
