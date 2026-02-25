import { NextResponse } from "next/server";
import { listProjects, createProject, ensureProject } from "@/lib/projectStore";
import {
  listProjectsFirestore,
  createProjectFirestore,
  ensureProjectFirestore,
} from "@/lib/projectStoreFirestore";
import { getAuthUserIdFromRequest, isFirestoreConfigured } from "@/lib/authServer";

export async function GET(request: Request) {
  const userId = await getAuthUserIdFromRequest(request);
  if (userId && isFirestoreConfigured()) {
    try {
      const projects = await listProjectsFirestore(userId);
      return NextResponse.json({ projects });
    } catch (e) {
      console.error("[projects] Firestore list failed:", e);
    }
  }
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() || "Untitled app" : "Untitled app";
  const id = typeof body.id === "string" ? body.id.trim() : undefined;

  const userId = await getAuthUserIdFromRequest(request);
  if (userId && isFirestoreConfigured()) {
    try {
      const project = id
        ? await ensureProjectFirestore(userId, id, name)
        : await createProjectFirestore(userId, name, id);
      // Also ensure in-memory for other API routes (message/stream, etc.)
      ensureProject(project.id, project.name);
      return NextResponse.json(project);
    } catch (e) {
      console.error("[projects] Firestore create/ensure failed:", e);
    }
  }

  const project = id ? ensureProject(id, name) : createProject(name);
  return NextResponse.json(project);
}
