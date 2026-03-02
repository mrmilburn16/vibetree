import { getAllBuildJobs, markAbandonedJobs, type BuildJobRecord } from "@/lib/buildJobs";
import { getActiveGenerations } from "@/lib/activeGenerations";
import { getProject } from "@/lib/projectStore";

function displayNameForProject(projectId: string, fallback: string): string {
  const project = getProject(projectId);
  return project?.name?.trim() || fallback || "Untitled app";
}

export async function GET() {
  markAbandonedJobs();
  const all: BuildJobRecord[] = getAllBuildJobs();
  const active = all.filter(
    (j: BuildJobRecord) =>
      j.status === "queued" ||
      j.status === "running" ||
      (j.status === "failed" && j.autoFixInProgress)
  );

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
        projectName: displayNameForProject(g.projectId, g.projectName),
        bundleId: "",
      },
      logs: [],
      _generationPhase: g.phase,
    }));

  const combined = [
    ...generationJobs,
    ...active.map((j) => ({
      ...j,
      request: {
        ...j.request,
        projectName: displayNameForProject(j.request.projectId, j.request.projectName),
      },
    })),
  ];
  combined.sort((a, b) => b.createdAt - a.createdAt);

  if (generationJobs.length > 0) {
    console.log("[build-jobs/active] Returning", combined.length, "jobs,", generationJobs.length, "from generations (sim/build):", generationJobs.map((g) => ({ id: g.id, name: g.request.projectName })));
  }

  return Response.json({ jobs: combined });
}
