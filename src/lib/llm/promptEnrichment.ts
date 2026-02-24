import {
  detectSkills,
  buildSkillPromptBlock,
  loadSkill,
} from "@/lib/skills/registry";
import type { SkillMatch } from "@/lib/skills/types";
import type { ProjectType } from "@/types";

export type { ProjectType };

export interface EnrichmentResult {
  message: string;
  skillIds: string[];
}

/**
 * Detect skills needed by the prompt and return the enriched message plus
 * the list of matched skill IDs (for build-result tracking).
 */
export function enrichWithSkills(
  projectType: ProjectType,
  message: string,
): EnrichmentResult {
  if (projectType !== "pro") return { message, skillIds: [] };
  const trimmed = (message ?? "").trim();
  if (!trimmed) return { message, skillIds: [] };

  const matches: SkillMatch[] = detectSkills(trimmed);
  if (matches.length === 0) return { message: trimmed, skillIds: [] };

  const skillIds = matches.map((m) => m.skill.id);
  return { message: trimmed, skillIds };
}

/**
 * Build the system-prompt appendix from a list of skill IDs.
 */
export function buildSkillSystemPrompt(skillIds: string[]): string {
  if (skillIds.length === 0) return "";
  const matched: SkillMatch[] = skillIds
    .map((id) => {
      const skill = loadSkill(id);
      if (!skill) return null;
      return { skill, matchCount: 1, matchedKeywords: [] } as SkillMatch;
    })
    .filter((m): m is SkillMatch => m !== null);

  return buildSkillPromptBlock(matched);
}

/**
 * Legacy-compatible wrapper: enriches the user message by appending
 * engineering hints inline (keeps the existing call-site signature).
 */
export function enrichUserMessageForProjectType(
  projectType: ProjectType,
  message: string,
): string {
  const { message: enriched } = enrichWithSkills(projectType, message);
  return enriched;
}
