import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { loadAllSkills } from "@/lib/skills/registry";

const SEED_PATH = join(process.cwd(), "CAPABILITY_IDEAS", "seed.json");

type SeedCapability = {
  folder: string;
  frameworks: string[];
  notes: string;
  ideas: Array<{
    slug: string;
    title: string;
    tier: "easy" | "medium" | "hard";
    prompt: string;
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const skillId = url.searchParams.get("skillId");

  if (!existsSync(SEED_PATH)) {
    return Response.json({ error: "seed.json not found" }, { status: 404 });
  }

  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as {
    capabilities: SeedCapability[];
  };

  const skills = loadAllSkills();

  // Map each skill to its matching seed capabilities by framework overlap
  const results: Array<{
    skillId: string;
    skillName: string;
    ideas: Array<{
      title: string;
      prompt: string;
      tier: "easy" | "medium" | "hard";
      category: string;
    }>;
  }> = [];

  for (const skill of skills) {
    if (skillId && skill.id !== skillId) continue;

    const matchingIdeas: Array<{
      title: string;
      prompt: string;
      tier: "easy" | "medium" | "hard";
      category: string;
    }> = [];

    for (const cap of seed.capabilities) {
      const frameworkOverlap = cap.frameworks.some((f) =>
        skill.frameworks.includes(f),
      );
      if (!frameworkOverlap) continue;

      for (const idea of cap.ideas) {
        matchingIdeas.push({
          title: idea.title,
          prompt: idea.prompt,
          tier: idea.tier,
          category: cap.folder,
        });
      }
    }

    if (matchingIdeas.length > 0) {
      results.push({
        skillId: skill.id,
        skillName: skill.name,
        ideas: matchingIdeas,
      });
    }
  }

  return Response.json({ skills: results, total: results.length });
}
