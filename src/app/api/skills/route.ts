import { loadAllSkills } from "@/lib/skills/registry";

export async function GET() {
  const skills = loadAllSkills();

  const summary = skills.map((s) => ({
    id: s.id,
    name: s.name,
    frameworks: s.frameworks,
    version: s.version,
    keywordCount: s.detection.keywords.length,
    antiPatternCount: s.antiPatterns.length,
    canonicalCodeFiles: Object.keys(s.canonicalCode),
    stats: s.stats,
  }));

  return Response.json({ skills: summary, total: summary.length });
}
