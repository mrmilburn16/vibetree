import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebaseAuth";
import {
  getFirestoreProject,
  updateFirestoreProject,
  deleteFirestoreProject,
} from "@/lib/firestoreProjects";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyIdToken(request.headers.get("Authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const project = await getFirestoreProject(auth.uid, id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (e) {
    console.error("getFirestoreProject", e);
    return NextResponse.json(
      { error: "Failed to load project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyIdToken(request.headers.get("Authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: { name?: string; bundleId?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.bundleId === "string" && body.bundleId.trim()) updates.bundleId = body.bundleId.trim();
  if (Object.keys(updates).length === 0) {
    const project = await getFirestoreProject(auth.uid, id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(project);
  }
  try {
    await updateFirestoreProject(auth.uid, id, updates);
    const project = await getFirestoreProject(auth.uid, id);
    return NextResponse.json(project);
  } catch (e) {
    console.error("updateFirestoreProject", e);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyIdToken(request.headers.get("Authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteFirestoreProject(auth.uid, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("deleteFirestoreProject", e);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
