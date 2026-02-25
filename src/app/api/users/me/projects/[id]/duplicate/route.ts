import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebaseAuth";
import {
  getFirestoreProject,
  createFirestoreProject,
  getFirestoreProjectFiles,
  setFirestoreProjectFiles,
  getFirestoreChat,
  setFirestoreChat,
} from "@/lib/firestoreProjects";

function makeProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeDefaultBundleId(id: string): string {
  const raw = id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = raw && /^[a-z]/.test(raw) ? raw : `app${raw || "project"}`;
  return `com.vibetree.${suffix}`.slice(0, 60);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyIdToken(request.headers.get("Authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const source = await getFirestoreProject(auth.uid, id);
  if (!source) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const newId = makeProjectId();
  const newName = `${source.name} (copy)`;
  const bundleId = makeDefaultBundleId(newId);
  try {
    await createFirestoreProject(auth.uid, newId, newName, bundleId);
    const [files, messages] = await Promise.all([
      getFirestoreProjectFiles(auth.uid, id),
      getFirestoreChat(auth.uid, id),
    ]);
    if (files.length > 0) await setFirestoreProjectFiles(auth.uid, newId, files);
    if (messages.length > 0) await setFirestoreChat(auth.uid, newId, messages);
    const project = await getFirestoreProject(auth.uid, newId);
    return NextResponse.json(project);
  } catch (e) {
    console.error("duplicate project", e);
    return NextResponse.json(
      { error: "Failed to duplicate project" },
      { status: 500 }
    );
  }
}
