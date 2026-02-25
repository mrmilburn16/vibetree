import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebaseAuth";
import {
  getFirestoreProjects,
  createFirestoreProject,
} from "@/lib/firestoreProjects";

function makeProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeDefaultBundleId(id: string): string {
  const raw = id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = raw && /^[a-z]/.test(raw) ? raw : `app${raw || "project"}`;
  return `com.vibetree.${suffix}`.slice(0, 60);
}

export async function GET(request: Request) {
  const auth = await verifyIdToken(request.headers.get("Authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const projects = await getFirestoreProjects(auth.uid);
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("getFirestoreProjects", e);
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await verifyIdToken(request.headers.get("Authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() || "Untitled app" : "Untitled app";
  const id = makeProjectId();
  const bundleId = makeDefaultBundleId(id);
  try {
    const project = await createFirestoreProject(auth.uid, id, name, bundleId);
    return NextResponse.json(project);
  } catch (e) {
    console.error("createFirestoreProject", e);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
