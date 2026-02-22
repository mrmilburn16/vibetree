import {
  getBuildJob,
  createBuildJob,
  setBuildJobNextJob,
  appendBuildJobLogs,
  setBuildJobAutoFixInProgress,
} from "@/lib/buildJobs";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";
import { preBuildLint } from "@/lib/preBuildLint";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

type SwiftFile = { path: string; content: string };

const FIX_MODEL = "claude-sonnet-4-5-20250929";
const FIX_MAX_TOKENS = 32000;

const FIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["explanation", "files"],
  properties: {
    explanation: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
      },
    },
  },
} as const;

/**
 * Extract file names mentioned in compiler errors (e.g.
 * "Views/CardEditorSheet.swift:42:13: error: ...")
 */
function extractErrorFileNames(errors: string[]): Set<string> {
  const names = new Set<string>();
  for (const err of errors) {
    const m = err.match(/([A-Za-z0-9_/]+\.swift):\d+/);
    if (m?.[1]) {
      let p = m[1];
      if (p.startsWith("/")) {
        const idx = p.lastIndexOf("/Sources/");
        if (idx >= 0) p = p.slice(idx + "/Sources/".length);
        else {
          const parts = p.split("/");
          p = parts[parts.length - 1];
        }
      }
      names.add(p);
      const base = p.split("/").pop()!;
      names.add(base);
    }
  }
  return names;
}

/**
 * Build a compact type-signature summary of a Swift file so the LLM knows
 * what types, protocols, and public API surface exist without the full code.
 */
function buildTypeSummary(file: SwiftFile): string {
  const lines = file.content.split("\n");
  const sigs: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^(import |struct |class |enum |protocol |extension |@main|@Observable|@Model|func |var |let |case )/.test(trimmed) ||
      /^(public |private |internal |open |final )/.test(trimmed)
    ) {
      sigs.push(trimmed.replace(/\{.*$/, "").trim());
    }
  }
  return sigs.join("\n");
}

/**
 * Determine which files the LLM needs to see in full, and which ones
 * only need a type summary for context.
 */
function partitionFiles(
  allFiles: SwiftFile[],
  errorFileNames: Set<string>
): { fullFiles: SwiftFile[]; contextFiles: { path: string; summary: string }[] } {
  if (errorFileNames.size === 0) {
    return { fullFiles: allFiles, contextFiles: [] };
  }

  const fullFiles: SwiftFile[] = [];
  const contextFiles: { path: string; summary: string }[] = [];

  for (const f of allFiles) {
    const baseName = f.path.split("/").pop() ?? f.path;
    if (errorFileNames.has(f.path) || errorFileNames.has(baseName)) {
      fullFiles.push(f);
    } else {
      contextFiles.push({ path: f.path, summary: buildTypeSummary(f) });
    }
  }

  if (fullFiles.length === 0) {
    return { fullFiles: allFiles, contextFiles: [] };
  }

  return { fullFiles, contextFiles };
}

const AUTO_FIX_SYSTEM_PROMPT = `You are a Swift compiler-error repair specialist. Your ONLY job is to fix compilation errors in an existing SwiftUI iOS project so it builds successfully with xcodebuild.

Rules:
1. Fix ONLY what is broken. Do NOT change app behavior, styling, or architecture.
2. Common Swift/SwiftUI errors and their fixes:
   - "Cannot find type 'X' in scope": add missing import (SwiftUI, Foundation, UIKit) or ensure the type is defined. Check if there's a typo.
   - "Extra trailing closure passed in call": Remove the trailing closure syntax and use explicit parameter labels instead.
   - "Value of type 'X' has no member 'Y'": The API doesn't exist. Use the correct SwiftUI API.
   - "Missing return in closure": Add explicit return statement.
   - "Type 'X' does not conform to protocol 'Y'": Implement required protocol methods/properties.
   - "Cannot convert value of type 'X' to expected type 'Y'": Use proper type conversion.
   - "$viewModel" without a property: Use viewModel (no $) unless binding a specific property like $viewModel.isRunning.
   - String interpolation escaping: Write .currency(code: "USD") not .currency(code: \\"USD\\").
3. Every file you return must be COMPLETE (full file content, not just the changed parts).
4. Return ALL files that you modified. For files you didn't change, do NOT return them.
5. Preserve all imports, all types, all function signatures unless a signature itself is the error.

Output: JSON { "explanation": "what you fixed", "files": [{ "path": "...", "content": "..." }] }`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const failedJobId = typeof body?.failedJobId === "string" ? body.failedJobId : "";
  if (!failedJobId) return Response.json({ error: "failedJobId required" }, { status: 400 });

  const failedJob = getBuildJob(failedJobId);
  if (!failedJob) return Response.json({ error: "Job not found" }, { status: 404 });
  if (failedJob.status !== "failed") return Response.json({ error: "Job is not in failed state" }, { status: 400 });

  const attempt = (failedJob.request.attempt ?? 1) + 1;
  const maxAttempts = failedJob.request.maxAttempts ?? 8;
  const userPrompt = failedJob.request.userPrompt;
  if (attempt > maxAttempts) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: `Max attempts (${maxAttempts}) reached` });
  }

  const currentFiles: SwiftFile[] = failedJob.request.files ?? [];
  if (currentFiles.length === 0) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: "No source files in job to fix" });
  }

  const errors = failedJob.compilerErrors ?? [];
  const logLines = failedJob.logs ?? [];
  if (errors.length === 0 && logLines.length === 0) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: "No compiler errors or build log to fix" });
  }

  const simplifyInstruction = attempt >= 4
    ? `\n\nIMPORTANT: This is attempt ${attempt} of ${maxAttempts}. Previous fixes have not resolved all errors. If you cannot fix an error cleanly, SIMPLIFY the code: remove the problematic feature entirely rather than continuing to fail. A simpler app that compiles is far better than a complex app that doesn't. Remove any feature that uses an API you're unsure about.`
    : "";

  appendBuildJobLogs(failedJobId, [`Auto-fixing with LLM (attempt ${attempt}/${maxAttempts})…`]);

  const errorFileNames = extractErrorFileNames(errors);
  const logErrorLines = logLines.filter(
    (l) => /\.swift:\d+.*error:/.test(l) || /error:/.test(l)
  );
  for (const l of logErrorLines) {
    const m = l.match(/([A-Za-z0-9_/]+\.swift):\d+/);
    if (m?.[1]) {
      const base = m[1].split("/").pop()!;
      errorFileNames.add(base);
      errorFileNames.add(m[1]);
    }
  }

  const sendAllFull = attempt >= 3;
  const { fullFiles, contextFiles } = sendAllFull
    ? { fullFiles: currentFiles, contextFiles: [] as { path: string; summary: string }[] }
    : partitionFiles(currentFiles, errorFileNames);
  appendBuildJobLogs(failedJobId, [
    `Files with errors: ${fullFiles.map((f) => f.path).join(", ")}`,
    `Context-only files: ${contextFiles.map((f) => f.path).join(", ") || "(none)"}`,
  ]);

  const errorSection = errors.length > 0
    ? `COMPILER ERRORS:\n${errors.join("\n")}`
    : "";
  const logErrorSection = logErrorLines.length > 0
    ? `\nADDITIONAL ERROR LINES FROM BUILD LOG:\n${logErrorLines.slice(-200).join("\n")}`
    : "";

  const fullLogTail = logLines.length > 0
    ? `\nFULL BUILD LOG (last 200 lines):\n${logLines.slice(-200).join("\n")}`
    : "";

  const fullFilesSection = fullFiles
    .map((f) => `=== ${f.path} (FIX THIS FILE) ===\n${f.content}`)
    .join("\n\n");

  const contextSection = contextFiles.length > 0
    ? `\nOTHER PROJECT FILES (type signatures only — do NOT return these unless you need to fix them too):\n${contextFiles.map((f) => `--- ${f.path} ---\n${f.summary}`).join("\n\n")}`
    : "";

  const userPromptSection = userPrompt
    ? `\nORIGINAL USER REQUEST:\n"${userPrompt}"\nFix the code to match this intent while resolving all compilation errors.\n`
    : "";

  const prompt = `${errorSection}${logErrorSection}
${userPromptSection}
FILES THAT NEED FIXING:
${fullFilesSection}
${contextSection}
${fullLogTail}

Fix ALL the compilation errors listed above. Return the corrected files with their complete content.${simplifyInstruction}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  try {
    const client = new Anthropic({ apiKey });

    async function callLLMStreaming(userPrompt: string): Promise<{ fixedFiles: SwiftFile[]; explanation: string; raw: string; stopReason: string }> {
      const stream = client.messages.stream({
        model: FIX_MODEL,
        max_tokens: FIX_MAX_TOKENS,
        system: AUTO_FIX_SYSTEM_PROMPT,
        output_config: { format: jsonSchemaOutputFormat(FIX_SCHEMA) },
        messages: [{ role: "user", content: userPrompt }],
      });
      const finalMessage = await stream.finalMessage();
      const parsedOutput = (finalMessage as unknown as { parsed_output?: unknown }).parsed_output;
      let fixedFiles: SwiftFile[] = [];
      let explanation = "";
      if (
        parsedOutput &&
        typeof parsedOutput === "object" &&
        Array.isArray((parsedOutput as Record<string, unknown>).files)
      ) {
        const po = parsedOutput as { explanation?: string; files: SwiftFile[] };
        fixedFiles = po.files.filter(
          (f) => typeof f?.path === "string" && typeof f?.content === "string"
        );
        explanation = po.explanation ?? "";
      }
      const msg = finalMessage as unknown as Record<string, unknown>;
      const textContent = Array.isArray(msg.content)
        ? (msg.content as Array<{ type: string; text?: string }>)
            .filter((b) => b.type === "text" && typeof b.text === "string")
            .map((b) => b.text)
            .join("")
        : "";
      return { fixedFiles, explanation, raw: textContent, stopReason: String(msg.stop_reason ?? "") };
    }

    let result = await callLLMStreaming(prompt);
    let fixedFiles = result.fixedFiles;
    let explanation = result.explanation;

    if (fixedFiles.length === 0) {
      appendBuildJobLogs(failedJobId, [
        `LLM returned no files. stop_reason=${result.stopReason}`,
        `Raw output preview: ${result.raw.slice(0, 200)}`,
      ]);

      appendBuildJobLogs(failedJobId, ["Retrying with all files included…"]);
      const retryPrompt = `This Swift/SwiftUI project won't compile.\n\n${errorSection}\n\nHere are ALL the files:\n\n${currentFiles.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n")}\n\nFix the compilation errors and return the corrected files.`;
      const retryResult = await callLLMStreaming(retryPrompt);
      fixedFiles = retryResult.fixedFiles;
      explanation = retryResult.explanation;
    }

    if (fixedFiles.length === 0) {
      appendBuildJobLogs(failedJobId, ["LLM returned no files after retry."]);
      setBuildJobAutoFixInProgress(failedJobId, false);
      return Response.json({ gaveUp: true, reason: "LLM could not produce fixed files" });
    }

    appendBuildJobLogs(failedJobId, [
      `LLM explanation: ${explanation}`,
      `LLM returned ${fixedFiles.length} fixed file(s): ${fixedFiles.map((f) => f.path).join(", ")}`,
    ]);

    const fixedPathSet = new Set(fixedFiles.map((f) => f.path));
    const mergedFiles: SwiftFile[] = currentFiles.map((orig) => {
      const fixed = fixedFiles.find((f) => f.path === orig.path);
      return fixed ?? orig;
    });
    for (const f of fixedFiles) {
      if (!mergedFiles.find((m) => m.path === f.path)) {
        mergedFiles.push(f);
      }
    }

    const corrected = fixSwiftCommonIssues(mergedFiles);

    const lintResult = preBuildLint(corrected);
    if (lintResult.autoFixCount > 0) {
      appendBuildJobLogs(failedJobId, [
        `Pre-build lint auto-fixed ${lintResult.autoFixCount} issue(s)`,
        ...lintResult.warnings.filter(w => w.autoFixed).map(w => `  Fixed: ${w.file}: ${w.message}`),
      ]);
    }
    const lintWarnings = lintResult.warnings.filter(w => !w.autoFixed);
    if (lintWarnings.length > 0) {
      appendBuildJobLogs(failedJobId, [
        `Pre-build lint warnings:`,
        ...lintWarnings.map(w => `  ${w.severity}: ${w.file}: ${w.message}`),
      ]);
    }

    appendBuildJobLogs(failedJobId, [
      `Merged: ${corrected.length} total files (${fixedPathSet.size} modified by LLM).`,
    ]);

    const retryJob = createBuildJob({
      projectId: failedJob.request.projectId,
      projectName: failedJob.request.projectName,
      bundleId: failedJob.request.bundleId,
      developmentTeam: failedJob.request.developmentTeam,
      files: lintResult.files,
      autoFix: true,
      attempt,
      maxAttempts,
      parentJobId: failedJobId,
      userPrompt: failedJob.request.userPrompt,
    });

    setBuildJobNextJob(failedJobId, retryJob.id);
    appendBuildJobLogs(failedJobId, [`Created retry job ${retryJob.id} (attempt ${attempt}/${maxAttempts})`]);

    return Response.json({ retryJobId: retryJob.id, attempt, maxAttempts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appendBuildJobLogs(failedJobId, [`LLM fix error: ${msg}`]);
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: msg }, { status: 500 });
  }
}
