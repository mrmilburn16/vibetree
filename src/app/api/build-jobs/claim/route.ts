import { claimNextBuildJob } from "@/lib/buildJobs";

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

  const job = claimNextBuildJob(auth.runnerId);
  if (!job) return new Response(null, { status: 204 });

  return Response.json({ job });
}
