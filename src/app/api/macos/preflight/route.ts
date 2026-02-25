import { NextResponse } from "next/server";
import { getRunnerDevices } from "@/lib/runnerDevices";
import { getProjectFilePaths } from "@/lib/projectFileStore";

export const runtime = "nodejs";

const RUNNER_STALE_MS = 30_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamId = (url.searchParams.get("teamId") ?? "").trim();
  const projectId = (url.searchParams.get("projectId") ?? "").trim();

  const snap = getRunnerDevices();
  const runnerFresh = snap != null && Date.now() - snap.updatedAt < RUNNER_STALE_MS;

  const physicalDevices = runnerFresh
    ? snap!.physical.filter(
        (d) => d.kind === "physical" && /iPhone|iPad/i.test(d.name ?? "")
      )
    : [];
  const firstDevice = physicalDevices[0] ?? null;

  const effectiveTeamId =
    teamId || process.env.DEFAULT_DEVELOPMENT_TEAM || "";
  const teamIdValid = /^[A-Z0-9]{10}$/.test(effectiveTeamId);

  let fileCount = 0;
  if (projectId) {
    try {
      fileCount = getProjectFilePaths(projectId).filter((p) =>
        p.endsWith(".swift")
      ).length;
    } catch {}
  }

  return NextResponse.json({
    runner: {
      ok: runnerFresh,
      runnerId: runnerFresh ? snap!.runnerId : undefined,
    },
    device: {
      ok: firstDevice != null,
      name: firstDevice?.name ?? undefined,
      id: firstDevice?.id ?? undefined,
    },
    teamId: {
      ok: teamIdValid,
      value: teamIdValid ? effectiveTeamId : undefined,
    },
    files: {
      ok: fileCount > 0,
      count: fileCount,
    },
  });
}
