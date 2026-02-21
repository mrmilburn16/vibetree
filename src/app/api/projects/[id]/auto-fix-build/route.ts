import {
  getBuildJob,
  createBuildJob,
  setBuildJobNextJob,
  appendBuildJobLogs,
} from "@/lib/buildJobs";
import { getClaudeResponse } from "@/lib/llm/claudeAdapter";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";

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
  const maxAttempts = failedJob.request.maxAttempts ?? 3;
  if (attempt > maxAttempts) {
    return Response.json({ gaveUp: true, reason: `Max attempts (${maxAttempts}) reached` });
  }

  const errors = failedJob.compilerErrors ?? [];
  if (errors.length === 0) {
    return Response.json({ gaveUp: true, reason: "No compiler errors to fix" });
  }

  const currentFiles = failedJob.request.files ?? [];
  if (currentFiles.length === 0) {
    return Response.json({ gaveUp: true, reason: "No source files in job to fix" });
  }

  appendBuildJobLogs(failedJobId, [`Auto-fixing Swift errors (attempt ${attempt}/${maxAttempts})…`]);

  const prompt = `The following Swift project failed to compile with xcodebuild. Fix ALL of the compiler errors listed below. Return the complete corrected files.\n\nCompiler errors:\n${errors.join("\n")}\n\nFix every error. Do not add new features or change behavior — only fix the compile errors. Output the full corrected files.`;

  try {
    const llmResult = await getClaudeResponse(prompt, undefined, {
      currentFiles,
      projectType: "pro",
    });

    const fixedFiles = llmResult.parsedFiles ?? [];
    if (fixedFiles.length === 0) {
      appendBuildJobLogs(failedJobId, ["Auto-fix returned no files. Giving up."]);
      return Response.json({ gaveUp: true, reason: "LLM returned no files" });
    }

    const corrected = fixSwiftCommonIssues(fixedFiles);

    const retryJob = createBuildJob({
      projectId: failedJob.request.projectId,
      projectName: failedJob.request.projectName,
      bundleId: failedJob.request.bundleId,
      developmentTeam: failedJob.request.developmentTeam,
      files: corrected,
      autoFix: true,
      attempt,
      maxAttempts,
      parentJobId: failedJobId,
    });

    setBuildJobNextJob(failedJobId, retryJob.id);
    appendBuildJobLogs(failedJobId, [`Created retry job ${retryJob.id} (attempt ${attempt}/${maxAttempts})`]);

    return Response.json({ retryJobId: retryJob.id, attempt, maxAttempts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appendBuildJobLogs(failedJobId, [`Auto-fix error: ${msg}`]);
    return Response.json({ gaveUp: true, reason: msg }, { status: 500 });
  }
}
