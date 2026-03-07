import { NextResponse } from "next/server";
import { getProjectChat, setProjectChat } from "@/lib/projectChatStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";
import { getAllBuildJobs } from "@/lib/buildJobs";

export const runtime = "nodejs";

function asMessages(input: unknown): Array<{
  id: string;
  role: "user" | "assistant";
  content: string;
  editedFiles?: string[];
  usage?: { input_tokens: number; output_tokens: number };
  estimatedCostUsd?: number;
}> {
  if (!Array.isArray(input)) return [];
  const out: any[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const id = typeof (m as any).id === "string" ? (m as any).id : "";
    const role = (m as any).role === "user" || (m as any).role === "assistant" ? (m as any).role : null;
    const content = typeof (m as any).content === "string" ? (m as any).content : "";
    if (!id || !role) continue;
    out.push({
      id,
      role,
      content,
      ...(Array.isArray((m as any).editedFiles) ? { editedFiles: (m as any).editedFiles } : {}),
      ...((m as any).usage &&
      typeof (m as any).usage.input_tokens === "number" &&
      typeof (m as any).usage.output_tokens === "number"
        ? { usage: (m as any).usage }
        : {}),
      ...(typeof (m as any).estimatedCostUsd === "number" ? { estimatedCostUsd: (m as any).estimatedCostUsd } : {}),
    });
  }
  return out;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) {
    if (auth.status === 404) {
      console.warn("[chat] GET 404: project not found or not owned (see [projectAuth] log for Firestore existence)", {
        projectId: id,
      });
    }
    return auth;
  }
  const chat = await getProjectChat(id);
  const allJobs = getAllBuildJobs();
  const latestJob = allJobs
    .filter((j) => j.request?.projectId === id)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const buildJob =
    latestJob ?
      { id: latestJob.id, status: latestJob.status, error: latestJob.error ?? undefined }
    : undefined;
  return NextResponse.json({
    projectId: id,
    updatedAt: chat?.updatedAt ?? null,
    messages: chat?.messages ?? [],
    ...(buildJob && { buildJob }),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireProjectAuth(request, id);
  if (auth instanceof NextResponse) {
    if (auth.status === 404) console.warn("[chat] POST 404: project not found or not owned", { projectId: id });
    return auth;
  }
  const body = await request.json().catch(() => ({}));
  const messages = asMessages((body as any)?.messages);
  await setProjectChat(id, messages);
  return NextResponse.json({ ok: true, count: messages.length });
}

