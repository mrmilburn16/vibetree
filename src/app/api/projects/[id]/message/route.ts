import { NextResponse } from "next/server";
import { getProject, ensureProject } from "@/lib/projectStore";
import {
  setProjectFiles,
  getProjectFiles,
  getProjectFilePaths,
} from "@/lib/projectFileStore";
import { mockGetResponse } from "@/lib/llm/mockAdapter";
import { getClaudeResponse } from "@/lib/llm/claudeAdapter";
import { estimateCostUsd } from "@/lib/llm/usageCost";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";

const MAX_MESSAGE_LENGTH = 4000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.projectName === "string" ? body.projectName.trim() || "Untitled app" : "Untitled app";
  const project = getProject(projectId) ?? ensureProject(projectId, name);

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
  const projectType =
    body.projectType === "pro" ? "pro" : ("standard" as const);

  if (useRealLLM && !hasApiKey) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  let content: string;
  let editedFiles: string[];
  let usage: { input_tokens: number; output_tokens: number } | undefined;
  let estimatedCostUsd: number | undefined;
  let projectFilesForClient: Array<{ path: string; content: string }> | undefined;

  if (useRealLLM && hasApiKey) {
    const paths = getProjectFilePaths(projectId);
    const files = getProjectFiles(projectId);
    const currentFiles =
      files && paths.length > 0
        ? paths.map((path) => ({ path, content: files[path] ?? "" }))
        : undefined;

    let result: Awaited<ReturnType<typeof getClaudeResponse>>;
    let lastErr: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        result = await getClaudeResponse(message, model, {
          currentFiles,
          projectType,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error("AI request failed");
        const isParseError = lastErr.message.startsWith("Invalid structured response");
        if (isParseError && attempt < maxAttempts) {
          continue;
        }
        if (isParseError) {
          return NextResponse.json(
            { error: "AI response could not be parsed (retried once)" },
            { status: 422 }
          );
        }
        return NextResponse.json(
          { error: lastErr.message },
          { status: 503 }
        );
      }
    }

    if (lastErr) {
      return NextResponse.json(
        { error: lastErr.message },
        { status: 503 }
      );
    }

    content = result!.content;
    if (result!.usage) {
      usage = result!.usage;
      estimatedCostUsd = estimateCostUsd(model, result!.usage);
    }
    if (result!.parsedFiles?.length) {
      let filesToStore = result!.parsedFiles;
      if (projectType === "pro") {
        filesToStore = filesToStore.filter((f) => f.path.endsWith(".swift"));
        filesToStore = fixSwiftCommonIssues(filesToStore);
      }
      if (filesToStore.length > 0) {
        setProjectFiles(projectId, filesToStore);
        editedFiles = filesToStore.map((f) => f.path);
        if (projectType === "pro") {
          projectFilesForClient = filesToStore;
        }
      } else {
        editedFiles = result!.editedFiles;
      }
    } else {
      editedFiles = result!.editedFiles;
    }
  } else {
    const result = await mockGetResponse(message, model, projectType);
    content = result.content;
    editedFiles = result.editedFiles;
    if (result.parsedFiles?.length) {
      setProjectFiles(projectId, result.parsedFiles);
    }
  }

  return NextResponse.json({
    assistantMessage: {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content,
      editedFiles,
      ...(usage && { usage }),
      ...(estimatedCostUsd !== undefined && { estimatedCostUsd }),
      ...(projectFilesForClient && { projectFiles: projectFilesForClient }),
    },
    buildStatus: "live" as const,
  });
}
