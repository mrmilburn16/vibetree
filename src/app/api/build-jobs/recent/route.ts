import { getAllBuildJobs, type BuildJobRecord } from "@/lib/buildJobs";

export async function GET() {
  const all: BuildJobRecord[] = getAllBuildJobs();
  const terminal = all.filter((j: BuildJobRecord) => j.status === "succeeded" || j.status === "failed");
  terminal.sort((a: BuildJobRecord, b: BuildJobRecord) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));
  return Response.json({ jobs: terminal.slice(0, 20) });
}
