import { NextResponse } from "next/server";
import { getProjectChat, setProjectChat } from "@/lib/projectChatStore";

export const runtime = "nodejs";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  editedFiles?: string[];
  usage?: { input_tokens: number; output_tokens: number };
  estimatedCostUsd?: number;
};

function asMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ChatMessage[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const rec = m as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : "";
    const role = rec.role === "user" || rec.role === "assistant" ? rec.role : null;
    const content = typeof rec.content === "string" ? rec.content : "";
    if (!id || !role) continue;
    const usage = rec.usage as Record<string, unknown> | undefined;
    out.push({
      id,
      role,
      content,
      ...(Array.isArray(rec.editedFiles) ? { editedFiles: rec.editedFiles as string[] } : {}),
      ...(usage &&
      typeof usage.input_tokens === "number" &&
      typeof usage.output_tokens === "number"
        ? { usage: usage as { input_tokens: number; output_tokens: number } }
        : {}),
      ...(typeof rec.estimatedCostUsd === "number" ? { estimatedCostUsd: rec.estimatedCostUsd } : {}),
    });
  }
  return out;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chat = await getProjectChat(id);
  return NextResponse.json({ projectId: id, updatedAt: chat?.updatedAt ?? null, messages: chat?.messages ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const messages = asMessages((body as Record<string, unknown>)?.messages);
  await setProjectChat(id, messages);
  return NextResponse.json({ ok: true, count: messages.length });
}

