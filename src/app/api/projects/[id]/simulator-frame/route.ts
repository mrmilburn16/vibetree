import { NextResponse } from "next/server";
import { setSimulatorFrame } from "@/lib/simulatorFrameStore";

function requireRunnerAuth(request: Request): { ok: true } | { ok: false; response: Response } {
  const token = process.env.MAC_RUNNER_TOKEN;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Runner auth not configured" }, { status: 503 }) };
  }
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1] || m[1] !== token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}

/**
 * POST /api/projects/[id]/simulator-frame
 * Runner sends the latest simulator screenshot (binary body, image/png or image/jpeg).
 * Replaces any previous frame for this project.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRunnerAuth(request);
  if (!auth.ok) return auth.response;

  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });

  const arrayBuffer = await request.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) return NextResponse.json({ error: "Empty body" }, { status: 400 });

  setSimulatorFrame(projectId, buffer);
  return new Response(null, { status: 204 });
}
