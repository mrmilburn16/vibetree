import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebaseAuth";
import { getFirestoreChat, setFirestoreChat } from "@/lib/firestoreProjects";

function asMessages(input: unknown): Array<{
  id: string;
  role: string;
  content: string;
  editedFiles?: string[];
  usage?: unknown;
  estimatedCostUsd?: number;
}> {
  if (!Array.isArray(input)) return [];
  const out: Array<{ id: string; role: string; content: string; editedFiles?: string[]; usage?: unknown; estimatedCostUsd?: number }> = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const id = typeof (m as any).id === "string" ? (m as any).id : "";
    const role = typeof (m as any).role === "string" ? (m as any).role : "";
    const content = typeof (m as any).content === "string" ? (m as any).content : "";
    if (!id || !role) continue;
    out.push({
      id,
      role,
      content,
      ...(Array.isArray((m as any).editedFiles) ? { editedFiles: (m as any).editedFiles } : {}),
      ...((m as any).usage ? { usage: (m as any).usage } : {}),
      ...(typeof (m as any).estimatedCostUsd === "number" ? { estimatedCostUsd: (m as any).estimatedCostUsd } : {}),
    });
  }
  return out;
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
    const messages = await getFirestoreChat(auth.uid, id);
    return NextResponse.json({ projectId: id, messages });
  } catch (e) {
    console.error("getFirestoreChat", e);
    return NextResponse.json(
      { error: "Failed to load chat" },
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
  const messages = asMessages((body as any)?.messages);
  try {
    await setFirestoreChat(auth.uid, id, messages);
    return NextResponse.json({ ok: true, count: messages.length });
  } catch (e) {
    console.error("setFirestoreChat", e);
    return NextResponse.json(
      { error: "Failed to save chat" },
      { status: 500 }
    );
  }
}
