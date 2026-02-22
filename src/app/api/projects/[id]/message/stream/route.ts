import { getProject, ensureProject } from "@/lib/projectStore";
import {
  setProjectFiles,
  getProjectFiles,
  getProjectFilePaths,
} from "@/lib/projectFileStore";
import { getClaudeResponseStream } from "@/lib/llm/claudeAdapter";
import { estimateCostUsd } from "@/lib/llm/usageCost";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";

const MAX_MESSAGE_LENGTH = 4000;

function encodeLine(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const body = await request.json().catch(() => ({}));
  const name =
    typeof body.projectName === "string"
      ? body.projectName.trim() || "Untitled app"
      : "Untitled app";
  getProject(projectId) ?? ensureProject(projectId, name);

  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const model = typeof body.model === "string" ? body.model : undefined;
  const projectType =
    body.projectType === "pro" ? "pro" : ("standard" as const);

  if (!hasApiKey) {
    return Response.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  const paths = getProjectFilePaths(projectId);
  const files = getProjectFiles(projectId);
  const currentFiles =
    files && paths.length > 0
      ? paths.map((path) => ({ path, content: files[path] ?? "" }))
      : undefined;

  const estimatedInputChars =
    message.length +
    (currentFiles ? JSON.stringify(currentFiles).length : 0) +
    6000;
  const estimatedInputTokens = Math.ceil(estimatedInputChars / 4);

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let lastReceivedChars = 0;
      let closed = false;
      const maxAttempts = 2;
      let hasEmittedFirstTokens = false;
      let discoveredFilesCount = 0;

      const safeEnqueue = (obj: object) => {
        if (closed) return;
        try {
          controller.enqueue(encodeLine(obj));
        } catch {
          // The client can disconnect at any time; ignore writes after close.
        }
      };

      const enqueuePhase = (phase: string) => {
        safeEnqueue({
          type: "phase",
          phase,
          elapsedMs: Date.now() - startedAt,
        });
      };

      const enqueueProgress = (receivedChars: number) => {
        const outputTokensSoFar = Math.round(receivedChars / 4);
        const estimatedCostUsdSoFar = estimateCostUsd(model, {
          input_tokens: estimatedInputTokens,
          output_tokens: outputTokensSoFar,
        });
        safeEnqueue({
          type: "progress",
          receivedChars,
          estimatedCostUsdSoFar,
          elapsedMs: Date.now() - startedAt,
        });
      };

      // Emit immediately so the client never sits on "Connecting…" silently.
      enqueuePhase("starting_request");
      enqueueProgress(0);

      const heartbeat = setInterval(() => {
        enqueueProgress(lastReceivedChars);
      }, 2000);

      try {
        let result: Awaited<ReturnType<typeof getClaudeResponseStream>> | null = null;
        let lastErr: Error | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          enqueuePhase(attempt === 1 ? "waiting_for_first_tokens" : "retrying_request");

          try {
            result = await getClaudeResponseStream(
              message,
              model,
              { currentFiles, projectType },
              {
                onProgress: (data) => {
                  lastReceivedChars = data.receivedChars;
                  if (!hasEmittedFirstTokens && data.receivedChars > 0) {
                    hasEmittedFirstTokens = true;
                    enqueuePhase("receiving_output");
                  }
                  enqueueProgress(data.receivedChars);
                },
                onDiscoveredFilePath: (path) => {
                  discoveredFilesCount += 1;
                  safeEnqueue({
                    type: "file",
                    path,
                    count: discoveredFilesCount,
                    elapsedMs: Date.now() - startedAt,
                  });
                },
              }
            );
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error("AI request failed");
            const isParseError = lastErr.message.startsWith("Invalid structured response");
            if (isParseError && attempt < maxAttempts) {
              // keep the stream open and try again once
              continue;
            }
            throw lastErr;
          }
        }

        if (!result || lastErr) {
          throw lastErr ?? new Error("AI request failed");
        }

        enqueuePhase("validating_structured_output");

        const usage = result.usage;
        const estimatedCostUsd = usage
          ? estimateCostUsd(model, usage)
          : undefined;

        let editedFiles: string[];
        enqueuePhase("saving_files");
        let projectFilesForClient: Array<{ path: string; content: string }> | undefined;
        if (result.parsedFiles?.length) {
          let filesToStore = result.parsedFiles;
          if (projectType === "pro") {
            filesToStore = filesToStore.filter((f) => f.path.endsWith(".swift"));
            filesToStore = fixSwiftCommonIssues(filesToStore);
          }
          if (filesToStore.length > 0) {
            setProjectFiles(projectId, filesToStore);
            editedFiles = filesToStore.map((f) => f.path);
            projectFilesForClient = filesToStore;
          } else {
            editedFiles = result.editedFiles;
          }
        } else {
          editedFiles = result.editedFiles;
        }

        enqueuePhase("done_preview_updating");
        safeEnqueue({
          type: "done",
          assistantMessage: {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: result.content,
            editedFiles,
            ...(usage && { usage }),
            ...(estimatedCostUsd !== undefined && { estimatedCostUsd }),
          },
          ...(projectFilesForClient && { projectFiles: projectFilesForClient }),
          buildStatus: "live",
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "AI request failed";
        console.error("[message/stream] error", errorMessage);
        safeEnqueue({ type: "error", error: errorMessage });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      // Helps some proxies/dev servers flush streaming responses promptly
      "X-Accel-Buffering": "no",
    },
  });
}
