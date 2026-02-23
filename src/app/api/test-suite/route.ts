import {
  getAllTestSuiteRuns,
  createTestSuiteRun,
  updateTestSuiteRun,
  getRunsByMilestone,
} from "@/lib/testSuiteStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const milestone = searchParams.get("milestone");
  const runs = milestone ? getRunsByMilestone(milestone) : getAllTestSuiteRuns();
  return Response.json({ runs });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.action === "create") {
    const run = createTestSuiteRun(
      String(body.model ?? "sonnet-4.6"),
      "pro",
      body.milestone ?? undefined,
    );
    return Response.json({ run });
  }

  if (body.action === "update" && typeof body.id === "string") {
    const run = updateTestSuiteRun(body.id, {
      status: body.status,
      results: body.results,
      summary: body.summary,
    });
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    return Response.json({ run });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
