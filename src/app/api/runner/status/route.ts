import { NextResponse } from "next/server";
import { getRunnerStatus, shouldRunStuckJobCheck } from "@/lib/runnerStore";
import { markStuckJobs } from "@/lib/buildJobs";

/**
 * GET /api/runner/status
 * Returns runner online status (true if heartbeat received in last 60s).
 * Also runs stuck job detection every 2 minutes.
 */
export async function GET() {
  if (shouldRunStuckJobCheck()) {
    markStuckJobs();
  }
  const status = getRunnerStatus();
  return NextResponse.json({
    online: status.online,
    lastSeen: status.lastSeen,
    runnerId: status.runnerId,
  });
}
