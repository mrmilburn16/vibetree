import { getAllBuildJobs, type BuildJobRecord } from "@/lib/buildJobs";
import { getActiveGenerations } from "@/lib/activeGenerations";

export async function GET() {
  const all: BuildJobRecord[] = getAllBuildJobs();
  const active = all.filter((j: BuildJobRecord) => j.status === "queued" || j.status === "running");

  const generations = getActiveGenerations();
  const activeBuildJobIds = new Set(active.map((j) => j.id));

  const generationJobs = generations
    .filter((g) => !g.buildJobId || !activeBuildJobIds.has(g.buildJobId))
    .map((g) => ({
      id: g.id,
      createdAt: g.startedAt,
      startedAt: g.startedAt,
      status: "generating" as const,
      request: {
        projectId: g.projectId,
        projectName: g.projectName,
        bundleId: "",
      },
      logs: [],
      _generationPhase: g.phase,
    }));

  const combined = [...generationJobs, ...active];
  combined.sort((a, b) => b.createdAt - a.createdAt);

  return Response.json({ jobs: combined });
}
