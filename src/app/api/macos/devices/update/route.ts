import { NextResponse } from "next/server";
import { setRunnerDevices, type RunnerDevice } from "@/lib/runnerDevices";

export const runtime = "nodejs";

function requireRunnerAuth(request: Request): { ok: true; runnerId: string } | { ok: false; response: Response } {
  const token = process.env.MAC_RUNNER_TOKEN;
  if (!token) {
    return { ok: false, response: Response.json({ error: "Runner auth not configured" }, { status: 503 }) };
  }
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1] || m[1] !== token) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const runnerId = request.headers.get("x-runner-id") ?? `runner_${Date.now()}`;
  return { ok: true, runnerId };
}

export async function POST(request: Request) {
  const auth = requireRunnerAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const physical = Array.isArray(body?.physical) ? (body.physical as RunnerDevice[]) : [];
  const simulators = Array.isArray(body?.simulators) ? (body.simulators as RunnerDevice[]) : [];
  setRunnerDevices({
    runnerId: auth.runnerId,
    updatedAt: Date.now(),
    physical: physical.filter((d) => d && typeof d.name === "string").slice(0, 50),
    simulators: simulators.filter((d) => d && typeof d.name === "string").slice(0, 200),
  });

  return NextResponse.json({ ok: true });
}

