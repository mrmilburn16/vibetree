import { getAllBuildJobs } from "@/lib/buildJobs";

export async function GET() {
  const all = getAllBuildJobs();
  const terminal = all.filter((j) => j.status === "succeeded" || j.status === "failed");
  terminal.sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));
  return Response.json({ jobs: terminal.slice(0, 20) });
}
