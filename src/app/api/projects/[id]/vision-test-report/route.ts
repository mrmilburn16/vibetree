import { NextResponse } from "next/server";
import { setVisionTestReport, getVisionTestReport, type VisionTestReport } from "@/lib/visionTestStore";

/**
 * POST /api/projects/[id]/vision-test-report
 * Save the vision test report for this project (called by client after completing the test loop).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });

  let body: VisionTestReport;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.projectId !== projectId) {
    return NextResponse.json({ error: "projectId mismatch" }, { status: 400 });
  }

  setVisionTestReport(projectId, body);
  return NextResponse.json({ ok: true, projectId });
}

/**
 * GET /api/projects/[id]/vision-test-report
 * Return the stored vision test report if it exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });

  const report = getVisionTestReport(projectId);
  if (!report) {
    return NextResponse.json({ report: null }, { status: 200 });
  }
  return NextResponse.json({ report });
}
