import { NextResponse } from "next/server";
import { setProject, type ProjectRecord } from "@/lib/projectStore";
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
import { requireProjectAuth } from "@/lib/apiProjectAuth";
import { hasActiveSubscription } from "@/lib/subscriptionFirestore";
import { getCreditBalance, deductCredits } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";

const MAX_MESSAGE_LENGTH = 4000;
/** Max retries when Anthropic returns 529 overloaded_error (same as auto-fix route). */
const MAX_OVERLOAD_RETRIES = 3;
/** Delay before retrying after an overload (529). */
const OVERLOAD_RETRY_DELAY_MS = 10_000;

/** True only when error is explicitly Anthropic overload (529 or error.type === "overloaded_error"). No message-based guess. */
function isOverloadError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const status = (e as { status?: number }).status;
  if (status === 529) return true;
  const errBody = (e as { error?: { type?: string } }).error;
  if (errBody && typeof errBody === "object" && (errBody as { type?: string }).type === "overloaded_error")
    return true;
  return false;
}

/** Log full error object when we are about to treat it as overload (retry or user message). */
function logOverloadError(context: string, err: unknown): void {
  const payload: Record<string, unknown> = {
    context,
    message: err instanceof Error ? err.message : String(err ?? ""),
    name: err instanceof Error ? err.name : undefined,
    status: (err as { status?: number }).status,
    error: (err as { error?: unknown }).error,
  };
  if (err instanceof Error && err.stack) payload.stack = err.stack;
  try {
    if (err && typeof err === "object") {
      const rest = { ...err } as Record<string, unknown>;
      if (Object.keys(rest).length > 0) payload.rawKeys = Object.keys(rest);
    }
  } catch {
    // ignore
  }
  console.warn("[message/stream] treating error as overload — full error object:", JSON.stringify(payload, null, 2));
}

/** User-facing error message; never send raw Anthropic error JSON to the client. */
function sanitizeStreamError(err: unknown): string {
  if (isOverloadError(err)) return "Anthropic servers are busy. Please try again in a few minutes.";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/^\s*\{/.test(msg.trim())) return "AI request failed. Please try again.";
  return msg || "AI request failed. Please try again.";
}

function encodeLine(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

function toRecord(doc: { id: string; name: string; bundleId: string; projectType: "standard" | "pro"; createdAt: number; updatedAt: number }): ProjectRecord {
  return { id: doc.id, name: doc.name, bundleId: doc.bundleId, projectType: doc.projectType, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[message/stream] POST invoked", { path: request.url });
  const { id: projectId } = await params;
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;
  const { project } = auth;
  setProject(toRecord(project));
  const body = await request.json().catch(() => ({}));

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
  if (projectType === "pro") {
    const allowed = await hasActiveSubscription(auth.user.uid);
    if (!allowed) {
      return Response.json(
        { error: "Pro features require an active subscription. Subscribe at /pricing." },
        { status: 403 }
      );
    }
  }

  const userId = auth.user.uid;
  if (!isProxyOwner(userId)) {
    const balance = await getCreditBalance(userId);
    if (balance < 1) {
      return Response.json(
        { error: "insufficient_credits" },
        { status: 402 }
      );
    }
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
        let overloadRetries = 0;

        outer: while (true) {
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
                  onSummaryChunk: (text) => {
                    safeEnqueue({ type: "content", text });
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
              break outer;
            } catch (err) {
              lastErr = err instanceof Error ? err : new Error("AI request failed");
              const isParseError = lastErr.message.startsWith("Invalid structured response");
              if (isParseError && attempt < maxAttempts) {
                continue;
              }
              if (isOverloadError(err) && overloadRetries < MAX_OVERLOAD_RETRIES) {
                logOverloadError("overload_retry", err);
                enqueuePhase("overload_retry");
                await new Promise((r) => setTimeout(r, OVERLOAD_RETRY_DELAY_MS));
                overloadRetries += 1;
                break;
              }
              throw lastErr;
            }
          }
          if (result) break;
          if (lastErr && isOverloadError(lastErr) && overloadRetries >= MAX_OVERLOAD_RETRIES) {
            logOverloadError("overload_final", lastErr);
            safeEnqueue({ type: "error", error: sanitizeStreamError(lastErr) });
            return;
          }
          if (lastErr && isOverloadError(lastErr)) continue;
          break;
        }

        if (!result || lastErr) {
          throw lastErr ?? new Error("AI request failed");
        }

        enqueuePhase("validating_structured_output");

        const usage = result.usage;
        const estimatedCostUsd = usage
          ? estimateCostUsd(model, usage)
          : undefined;
        console.log(
          `Tokens - input: ${usage?.input_tokens ?? 0}, cache_read: ${usage?.cache_read_input_tokens ?? 0}, cache_creation: ${usage?.cache_creation_input_tokens ?? 0}`,
        );

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

        if (!isProxyOwner(userId)) {
          const deductResult = await deductCredits(userId, 1);
          if (!deductResult.ok) {
            console.warn("[message/stream] deductCredits after success failed", { userId, error: deductResult.error });
          }
        }
      } catch (err) {
        const errorMessage = sanitizeStreamError(err);
        console.error("[message/stream] error", err instanceof Error ? err.message : String(err), err);
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
