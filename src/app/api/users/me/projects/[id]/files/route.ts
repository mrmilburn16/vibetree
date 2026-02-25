import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebaseAuth";
import {
  getFirestoreProjectFiles,
  setFirestoreProjectFiles,
} from "@/lib/firestoreProjects";

function asFiles(body: unknown): Array<{ path: string; content: string }> {
  if (!body || typeof body !== "object") return [];
  const arr = (body as { files?: unknown }).files;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((f) => f && typeof f === "object" && typeof (f as any).path === "string")
    .map((f) => ({
      path: (f as any).path,
      content: typeof (f as any).content === "string" ? (f as any).content : "",
    }));
}

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
    const files = await getFirestoreProjectFiles(auth.uid, id);
    return NextResponse.json({ files });
  } catch (e) {
    console.error("getFirestoreProjectFiles", e);
    return NextResponse.json(
      { error: "Failed to load files" },
      { status: 500 }
    );
  }
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
  const body = await request.json().catch(() => ({}));
  const files = asFiles(body);
  try {
    await setFirestoreProjectFiles(auth.uid, id, files);
    return NextResponse.json({ ok: true, count: files.length });
  } catch (e) {
    console.error("setFirestoreProjectFiles", e);
    return NextResponse.json(
      { error: "Failed to save files" },
      { status: 500 }
    );
  }
}
