import { getAllBuildJobs } from "@/lib/buildJobs";

export async function GET() {
  const all = getAllBuildJobs();
  const active = all.filter((j) => j.status === "queued" || j.status === "running");
  active.sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({ jobs: active });
}
