import {
  getBuildJob,
  createBuildJob,
  setBuildJobNextJob,
  appendBuildJobLogs,
} from "@/lib/buildJobs";
import { applyRuleBasedFixesFromBuild } from "@/lib/llm/fixSwift";

/**
 * Auto-fix uses only the saved Swift files + build log/errors with rule-based patches.
 * No LLM call — no extra API credits. Retries up to maxAttempts with the same free rules.
 */
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

  const currentFiles = failedJob.request.files ?? [];
  if (currentFiles.length === 0) {
    return Response.json({ gaveUp: true, reason: "No source files in job to fix" });
  }

  const errors = failedJob.compilerErrors ?? [];
  const logLines = failedJob.logs ?? [];
  if (errors.length === 0 && logLines.length === 0) {
    return Response.json({ gaveUp: true, reason: "No compiler errors or build log to fix" });
  }

  appendBuildJobLogs(failedJobId, [`Auto-fixing with saved files (attempt ${attempt}/${maxAttempts}, no API call)…`]);

  const { files: fixedFiles, changed } = applyRuleBasedFixesFromBuild(currentFiles, errors, logLines);

  if (!changed) {
    appendBuildJobLogs(failedJobId, ["No rule-based fix applied. Edit in chat or open Run on device for logs."]);
    return Response.json({
      gaveUp: true,
      reason: "No automatic fix applied. You can describe the error in chat to fix with AI, or open Run on device to see logs.",
    });
  }

  const retryJob = createBuildJob({
    projectId: failedJob.request.projectId,
    projectName: failedJob.request.projectName,
    bundleId: failedJob.request.bundleId,
    developmentTeam: failedJob.request.developmentTeam,
    files: fixedFiles,
    autoFix: true,
    attempt,
    maxAttempts,
    parentJobId: failedJobId,
  });

  setBuildJobNextJob(failedJobId, retryJob.id);
  appendBuildJobLogs(failedJobId, [`Created retry job ${retryJob.id} (attempt ${attempt}/${maxAttempts})`]);

  return Response.json({ retryJobId: retryJob.id, attempt, maxAttempts });
}
