export interface ActiveGeneration {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: number;
  phase: "starting" | "generating" | "saving" | "validating" | "done";
  buildJobId?: string;
}

const g = globalThis as unknown as { __activeGenerations?: Map<string, ActiveGeneration> };
if (!g.__activeGenerations) g.__activeGenerations = new Map();
const generations = g.__activeGenerations;

export function startGeneration(projectId: string, projectName: string): ActiveGeneration {
  const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const gen: ActiveGeneration = {
    id,
    projectId,
    projectName,
    startedAt: Date.now(),
    phase: "starting",
  };
  generations.set(id, gen);
  return gen;
}

export function updateGenerationPhase(id: string, phase: ActiveGeneration["phase"]): void {
  const gen = generations.get(id);
  if (!gen) return;
  gen.phase = phase;
  generations.set(id, gen);
}

export function linkGenerationToBuildJob(id: string, buildJobId: string): void {
  const gen = generations.get(id);
  if (!gen) return;
  gen.buildJobId = buildJobId;
  gen.phase = "validating";
  generations.set(id, gen);
}

export function endGeneration(id: string): void {
  generations.delete(id);
}

/** Start a simulated build for testing Live Activities. Appears in /api/build-jobs/active for ~90s. */
export function startSimulation(projectName = "Simulated Build"): ActiveGeneration {
  const id = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const gen: ActiveGeneration = {
    id,
    projectId: id,
    projectName,
    startedAt: Date.now(),
    phase: "generating",
  };
  generations.set(id, gen);
  return gen;
}

export function getActiveGenerations(): ActiveGeneration[] {
  return Array.from(generations.values()).filter((g) => g.phase !== "done");
}
