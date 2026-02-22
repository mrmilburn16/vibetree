import { getBuildJob } from "@/lib/buildJobs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getBuildJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const isTerminal = job.status === "succeeded" || job.status === "failed";
  const { request, logs, ...rest } = job;
  const { files, ...requestWithoutFiles } = request;

  return Response.json({
    job: {
      ...rest,
      request: {
        ...requestWithoutFiles,
        ...(isTerminal && files ? { files } : {}),
      },
      logs: isTerminal ? logs : logs.slice(-20),
    },
  });
}
