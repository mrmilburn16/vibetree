import { cancelBuildJob, getBuildJob } from "@/lib/buildJobs";
import { NextResponse } from "next/server";

/**
 * POST /api/build-jobs/[id]/cancel
 * Mark a queued or running job as failed (cancelled by user). Lets Live Activities and UI stop showing "building".
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }
  const job = getBuildJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const cancelled = cancelBuildJob(id);
  if (!cancelled) {
    return NextResponse.json(
      { error: "Job cannot be cancelled (already finished or not started)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, id });
}
