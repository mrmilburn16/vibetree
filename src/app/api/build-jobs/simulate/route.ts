import { startSimulation, endGeneration } from "@/lib/activeGenerations";

const SIMULATION_DURATION_MS = 90_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectName =
    typeof body?.projectName === "string" && body.projectName.trim()
      ? body.projectName.trim()
      : "Simulated Build";

  const gen = startSimulation(projectName);

  setTimeout(() => {
    endGeneration(gen.id);
    console.log("[simulate] Ended simulation:", gen.id);
  }, SIMULATION_DURATION_MS);

  console.log("[simulate] Started:", gen.id, "projectName:", gen.projectName, "for", SIMULATION_DURATION_MS / 1000, "s");

  return Response.json({
    ok: true,
    id: gen.id,
    projectName: gen.projectName,
    message: `Simulation started for ${SIMULATION_DURATION_MS / 1000}s. Open the companion app and lock your phone to see the Live Activity.`,
  });
}
