import { getAllBuildJobs, type BuildJobRecord } from "@/lib/buildJobs";
import { getProject } from "@/lib/projectStore";

function displayNameForProject(projectId: string, fallback: string): string {
  const project = getProject(projectId);
  return project?.name?.trim() || fallback || "Untitled app";
}

export async function GET() {
  const all: BuildJobRecord[] = getAllBuildJobs();
  const terminal = all.filter((j: BuildJobRecord) => j.status === "succeeded" || j.status === "failed");
  terminal.sort((a: BuildJobRecord, b: BuildJobRecord) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));

  const jobs = terminal.slice(0, 20).map((j) => ({
    ...j,
    request: {
      ...j.request,
      projectName: displayNameForProject(j.request.projectId, j.request.projectName),
    },
  }));

  return Response.json({ jobs });
}
