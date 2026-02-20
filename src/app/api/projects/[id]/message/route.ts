import { NextResponse } from "next/server";
import { getProject } from "@/lib/projectStore";
import { mockGetResponse } from "@/lib/llm/mockAdapter";

const MAX_MESSAGE_LENGTH = 4000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  const useRealLLM = body.useRealLLM === true;
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  if (useRealLLM && !hasApiKey) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  const { content, editedFiles } = await mockGetResponse(
    message,
    typeof body.model === "string" ? body.model : undefined
  );

  return NextResponse.json({
    assistantMessage: {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content,
      editedFiles,
    },
    buildStatus: "live" as const,
  });
}
