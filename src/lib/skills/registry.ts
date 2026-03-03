import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import type { Skill, SkillMatch } from "./types";

const SKILLS_DIR = join(process.cwd(), "data", "skills");

function ensureDir() {
  if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

export function loadSkill(id: string): Skill | null {
  const p = join(SKILLS_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Skill;
  } catch {
    console.error(`[skills] Failed to parse ${id}.json`);
    return null;
  }
}

export function loadAllSkills(): Skill[] {
  ensureDir();
  try {
    return readdirSync(SKILLS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(SKILLS_DIR, f), "utf8")) as Skill;
        } catch {
          return null;
        }
      })
      .filter((s): s is Skill => s !== null);
  } catch {
    return [];
  }
}

export function saveSkill(skill: Skill): void {
  ensureDir();
  writeFileSync(
    join(SKILLS_DIR, `${skill.id}.json`),
    JSON.stringify(skill, null, 2) + "\n",
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// Detection — match a user prompt against all skills
// ---------------------------------------------------------------------------

function normalise(text: string): string {
  return text.toLowerCase().replace(/['']/g, "'");
}

export function detectSkills(prompt: string): SkillMatch[] {
  const skills = loadAllSkills();
  const hay = normalise(prompt);
  const matches: SkillMatch[] = [];

  for (const skill of skills) {
    const keywords = skill.detection?.keywords ?? [];
    const excludeKeywords = skill.detection?.excludeKeywords ?? [];
    const excludeHit = excludeKeywords.some((kw) =>
      hay.includes(normalise(kw)),
    );
    if (excludeHit) continue;

    const matched: string[] = [];
    for (const kw of keywords) {
      if (hay.includes(normalise(kw))) matched.push(kw);
    }

    if (matched.length > 0) {
      matches.push({ skill, matchCount: matched.length, matchedKeywords: matched });
    }
  }

  return matches.sort((a, b) => b.matchCount - a.matchCount);
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

export function recordBuildForSkill(
  skillId: string,
  compiled: boolean,
  firstAttempt: boolean,
  functionalScore: number | null,
  errors: string[],
): void {
  const skill = loadSkill(skillId);
  if (!skill) return;

  skill.stats.totalBuilds++;
  if (firstAttempt && compiled) skill.stats.firstAttemptCompile++;

  if (functionalScore !== null && functionalScore >= 4) {
    skill.stats.functionalSuccesses++;
  }

  for (const err of errors) {
    const norm = err.replace(/\S+\.swift:\d+(:\d+)?:\s*(error|warning):\s*/, "").trim();
    if (norm && !skill.stats.commonErrors.includes(norm)) {
      skill.stats.commonErrors.push(norm);
      if (skill.stats.commonErrors.length > 30) skill.stats.commonErrors.shift();
    }
  }

  const tb = skill.stats.totalBuilds;
  skill.stats.compileRate =
    tb > 0 ? Math.round((skill.stats.firstAttemptCompile / tb) * 100) : 0;
  skill.stats.functionalRate =
    tb > 0 ? Math.round((skill.stats.functionalSuccesses / tb) * 100) : 0;

  saveSkill(skill);
}

export function addGoldenExample(
  skillId: string,
  buildResultId: string,
  files: Record<string, string>,
): void {
  const skill = loadSkill(skillId);
  if (!skill) return;

  if (skill.stats.goldenExamples.length >= 3) {
    skill.stats.goldenExamples.shift();
  }
  skill.stats.goldenExamples.push({
    buildResultId,
    timestamp: new Date().toISOString(),
    files,
  });

  saveSkill(skill);
}

// ---------------------------------------------------------------------------
// Build the prompt injection block for a set of matched skills
// ---------------------------------------------------------------------------

export function buildSkillPromptBlock(matches: SkillMatch[]): string {
  if (matches.length === 0) return "";

  const sections = matches.map(({ skill }) => {
    const lines: string[] = [
      `--- CAPABILITY: ${skill.name} (${skill.frameworks.join(", ")}) ---`,
      skill.promptInjection,
    ];

    const codeEntries = Object.entries(skill.canonicalCode);
    if (codeEntries.length > 0) {
      lines.push("");
      lines.push("Reference code patterns (tested, working):");
      for (const [filename, code] of codeEntries) {
        lines.push(`// ${filename}`);
        lines.push(code);
      }
    }

    lines.push("---");
    return lines.join("\n");
  });

  return "\n\n" + sections.join("\n\n");
}
