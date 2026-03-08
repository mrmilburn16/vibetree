import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { reconcileRegressions } from "@/lib/errorPatternStatus";
import type { BuildResult } from "@/lib/buildResultsLog";

export const dynamic = "force-dynamic";

/** POST: run regression check. Body: { builds: BuildResult[] }. Returns { statuses }. */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const builds = Array.isArray(body.builds) ? (body.builds as BuildResult[]) : [];
  const statuses = await reconcileRegressions(builds);
  return NextResponse.json({ statuses });
}
