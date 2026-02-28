import { NextResponse } from "next/server";
import { recordHeartbeat } from "@/lib/runnerStore";

/**
 * POST /api/runner/heartbeat
 * Called by the Mac runner every 30s to indicate it is alive.
 * Body: { runnerId: string, timestamp: number, status: 'online' }
 */
export async function POST(request: Request) {
  const token = process.env.MAC_RUNNER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Runner not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1] || m[1] !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { runnerId?: string; timestamp?: number; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const runnerId = typeof body.runnerId === "string" ? body.runnerId.trim() : request.headers.get("x-runner-id") ?? "unknown";
  const status = typeof body.status === "string" ? body.status : "online";

  recordHeartbeat(runnerId, status);
  return NextResponse.json({ ok: true });
}
