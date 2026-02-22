import { getAllBuildJobs, type BuildJobRecord } from "@/lib/buildJobs";

export async function GET() {
  const all: BuildJobRecord[] = getAllBuildJobs();
  const active = all.filter((j: BuildJobRecord) => j.status === "queued" || j.status === "running");
  active.sort((a: BuildJobRecord, b: BuildJobRecord) => b.createdAt - a.createdAt);
  return Response.json({ jobs: active });
}
