import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/projectStore";
import { getProjectFromFirestore, updateProjectInFirestore } from "@/lib/projectsFirestore";
import { getAppetizePublicKey, setAppetizePublicKey } from "@/lib/appetizeStore";

/**
 * GET /api/projects/[id]/appetize
 * Returns the Appetize public key for this project. Database (Firestore / projectStore) is source of truth; in-memory appetizeStore is cache fallback.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });

  const fromLocal = getProject(projectId)?.appetizePublicKey;
  if (typeof fromLocal === "string" && fromLocal.length > 0) {
    setAppetizePublicKey(projectId, fromLocal);
    return NextResponse.json({ publicKey: fromLocal });
  }
  const fromFirestore = await getProjectFromFirestore(projectId);
  const fromDb = fromFirestore?.appetizePublicKey;
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
  await updateProjectInFirestore(projectId, { appetizePublicKey: publicKey });
  setAppetizePublicKey(projectId, publicKey);
  return NextResponse.json({ publicKey });
}
