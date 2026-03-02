import { NextResponse } from "next/server";
import { setProject, updateProject, type ProjectRecord } from "@/lib/projectStore";
import { updateProjectInFirestore } from "@/lib/projectsFirestore";
import { getAppetizePublicKey, setAppetizePublicKey } from "@/lib/appetizeStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

function toRecord(doc: { id: string; name: string; bundleId: string; projectType: "standard" | "pro"; createdAt: number; updatedAt: number }): ProjectRecord {
  return { id: doc.id, name: doc.name, bundleId: doc.bundleId, projectType: doc.projectType, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

/**
 * GET /api/projects/[id]/appetize
 * Returns the Appetize public key for this project. Database (Firestore / projectStore) is source of truth; in-memory appetizeStore is cache fallback.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;
  const { project } = auth;
  setProject(toRecord(project));
  const fromDb = project.appetizePublicKey;
  if (typeof fromDb === "string" && fromDb.length > 0) {
    setAppetizePublicKey(projectId, fromDb);
    return NextResponse.json({ publicKey: fromDb });
  }
  const fromMemory = getAppetizePublicKey(projectId);
  if (fromMemory) {
    return NextResponse.json({ publicKey: fromMemory });
  }
  return NextResponse.json({ publicKey: null }, { status: 200 });
}

/**
 * POST /api/projects/[id]/appetize
 * Store the Appetize public key for this project (called by Mac runner after successful upload).
 * Persists to project record in projectStore and Firestore; also updates in-memory cache.
 * Body: { publicKey: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;
  setProject(toRecord(auth.project));

  let body: { publicKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  if (!publicKey) {
    return NextResponse.json({ error: "publicKey is required" }, { status: 400 });
  }

  updateProject(projectId, { appetizePublicKey: publicKey });
  await updateProjectInFirestore(projectId, { appetizePublicKey: publicKey }, auth.user.uid);
  setAppetizePublicKey(projectId, publicKey);
  return NextResponse.json({ publicKey });
}
