import { NextResponse } from "next/server";
import { getProject } from "@/lib/projectStore";
import { mockGetResponse } from "@/lib/llm/mockAdapter";
import { getClaudeResponse } from "@/lib/llm/claudeAdapter";

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
  const model = typeof body.model === "string" ? body.model : undefined;

  if (useRealLLM && !hasApiKey) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  let content: string;
  let editedFiles: string[];

  if (useRealLLM && hasApiKey) {
    try {
      const result = await getClaudeResponse(message, model);
      content = result.content;
      editedFiles = result.editedFiles;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "AI request failed";
      return NextResponse.json(
        { error: errorMessage },
        { status: 503 }
      );
    }
  } else {
    const result = await mockGetResponse(message, model);
    content = result.content;
    editedFiles = result.editedFiles;
  }

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
