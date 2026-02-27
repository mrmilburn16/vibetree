import { getProject, ensureProject } from "@/lib/projectStore";
import {
  setProjectFiles,
  getProjectFiles,
  getProjectFilePaths,
} from "@/lib/projectFileStore";
import { getClaudeResponseStream } from "@/lib/llm/claudeAdapter";
import { estimateCostUsd } from "@/lib/llm/usageCost";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";
import { startGeneration, updateGenerationPhase, endGeneration } from "@/lib/activeGenerations";
import { enrichWithSkills } from "@/lib/llm/promptEnrichment";
import { detectSkills, buildSkillPromptBlock } from "@/lib/skills/registry";
import { logLLMAnalytics } from "@/lib/llm/analyticsLog";

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
  const nameFromBody =
    typeof body.projectName === "string"
      ? body.projectName.trim() || "Untitled app"
      : "Untitled app";
  const project = getProject(projectId) ?? ensureProject(projectId, nameFromBody);

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
  // Respect client's projectType; if missing/invalid, use project's stored type so Pro (Swift) isn't treated as Expo
  const projectType =
    body.projectType === "pro"
      ? ("pro" as const)
      : body.projectType === "standard"
        ? ("standard" as const)
        : (project.projectType === "pro"
          ? ("pro" as const)
          : ("standard" as const));
  if (body.projectType !== "pro" && body.projectType !== "standard") {
    console.warn("[message/stream] body.projectType missing or invalid, using project type", {
      bodyProjectType: body.projectType,
      projectProjectType: project.projectType,
      resolved: projectType,
    });
  }
  console.log("[message/stream] start", { projectId, projectType, model: body.model, msgLen: message.length });
  const { message: enrichedMessage, skillIds } = enrichWithSkills(projectType, message);
  const skillMatches = projectType === "pro" ? detectSkills(message) : [];
  const skillPromptBlock = buildSkillPromptBlock(skillMatches);

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

  const generation = startGeneration(projectId, project.name);

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
              enrichedMessage,
              model,
              { currentFiles, projectType, skillPromptBlock, projectName: currentFiles ? project.name : undefined },
              {
                onProgress: (data) => {
                  lastReceivedChars = data.receivedChars;
                  if (!hasEmittedFirstTokens && data.receivedChars > 0) {
                    hasEmittedFirstTokens = true;
                    enqueuePhase("receiving_output");
                    updateGenerationPhase(generation.id, "generating");
                  }
                  enqueueProgress(data.receivedChars);
                },
                onDiscoveredFilePath: (path) => {
                  discoveredFilesCount += 1;
                  const existing = paths.length > 0 && paths.includes(path);
                  safeEnqueue({
                    type: "file",
                    path,
                    existing,
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
        updateGenerationPhase(generation.id, "saving");
        if (result.parsedFiles?.length) {
          let filesToStore = result.parsedFiles;
          if (projectType === "pro") {
            filesToStore = filesToStore.filter((f) => f.path.endsWith(".swift"));
            filesToStore = fixSwiftCommonIssues(filesToStore);
            const { preBuildLint } = await import("@/lib/preBuildLint");
            const lintResult = preBuildLint(filesToStore);
            filesToStore = lintResult.files;
          }
          if (filesToStore.length > 0) {
            setProjectFiles(projectId, filesToStore);
            editedFiles = filesToStore.map((f) => f.path);
          } else {
            editedFiles = result.editedFiles;
          }
        } else {
          editedFiles = result.editedFiles ?? [];
          // When agent returns no files on a follow-up (e.g. "code is unchanged"), still run fixSwift
          // on stored files so black→systemBackground and other safety nets apply.
          if (paths.length > 0 && projectType === "pro") {
            const stored = getProjectFiles(projectId);
            if (stored) {
              const filesToFix = paths
                .filter((p) => p.endsWith(".swift"))
                .map((p) => ({ path: p, content: stored[p] ?? "" }))
                .filter((f) => f.content.length > 0);
              if (filesToFix.length > 0) {
                const fixed = fixSwiftCommonIssues(filesToFix);
                setProjectFiles(projectId, fixed);
                editedFiles = fixed.map((f) => f.path);
              }
            }
          }
        }

        // Send a small "done" payload (no projectFiles) so iOS and slow clients don't
        // fail to parse a multi‑MB line. Web/iOS can fetch GET /api/projects/:id/files if needed.
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
          buildStatus: "live",
          generationId: generation.id,
          ...(skillIds.length > 0 && { skillIds }),
        });
        console.log("[message/stream] done sent", { projectId, editedFilesCount: editedFiles.length });

        try {
          logLLMAnalytics({
            projectId,
            model: model ?? "sonnet-4.5",
            inputTokens: usage?.input_tokens ?? estimatedInputTokens,
            outputTokens: usage?.output_tokens ?? Math.round(lastReceivedChars / 4),
            cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
            cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
            estimatedCostUsd: estimatedCostUsd ?? 0,
            durationMs: Date.now() - startedAt,
            projectType,
          });
        } catch { /* analytics is best-effort */ }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "AI request failed";
        console.error("[message/stream] error", errorMessage, err);
        safeEnqueue({ type: "error", error: errorMessage });
      } finally {
        clearInterval(heartbeat);
        endGeneration(generation.id);
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
