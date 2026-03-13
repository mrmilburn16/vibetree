/**
 * Skill loader: reads skills from data/skills/*.json at startup, compiles trigger
 * patterns once, and exposes matchSkills() / getMatchedSkillNames() for prompt injection.
 *
 * Expected JSON shape: { "name": string, "triggers": string[], "promptBlock": string }
 * Optional: "alwaysLoad": true — skill is included on every request (triggers may be empty).
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export interface SkillDef {
  name: string;
  triggers: string[];
  promptBlock: string;
  alwaysLoad?: boolean;
}

function isSkillDef(obj: unknown): obj is SkillDef {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const hasTriggers = Array.isArray(o.triggers) && o.triggers.every((t) => typeof t === "string");
  const alwaysLoad = o.alwaysLoad === true;
  return (
    typeof o.name === "string" &&
    typeof o.promptBlock === "string" &&
    (alwaysLoad || (hasTriggers && (o.triggers as string[]).length > 0))
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[\\^$.|?*+()[\]{}]/g, "\\$&");
}

function compileTriggerPattern(trigger: string): RegExp {
  const escaped = escapeRegex(trigger.trim());
  return new RegExp(`\\b${escaped}\\b`, "i");
}

interface CachedSkill {
  name: string;
  file: string;
  promptBlock: string;
  patterns: RegExp[];
  triggers: string[];
  alwaysLoad?: boolean;
}

const SKILLS_DIR = join(process.cwd(), "data", "skills");
let cachedSkills: CachedSkill[] | null = null;

// --- Skill analytics (in-memory) ---
const skillTriggerCounts = new Map<string, number>();
const ZERO_MATCH_CAP = 100;
const zeroMatchMessages: string[] = [];

function loadAndCacheSkills(): CachedSkill[] {
  if (cachedSkills !== null) return cachedSkills;

  const skills: CachedSkill[] = [];

  if (!existsSync(SKILLS_DIR)) {
    cachedSkills = skills;
    return cachedSkills;
  }

  const files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    try {
      const raw = readFileSync(join(SKILLS_DIR, file), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isSkillDef(parsed)) continue;

      const triggers = Array.isArray(parsed.triggers) ? parsed.triggers : [];
      const patterns = triggers
        .filter((t: string) => t && typeof t === "string")
        .map((t: string) => compileTriggerPattern(t));

      if (!parsed.alwaysLoad && patterns.length === 0) continue;

      skills.push({
        name: parsed.name,
        file,
        promptBlock: parsed.promptBlock,
        patterns,
        triggers,
        alwaysLoad: parsed.alwaysLoad === true,
      });
    } catch {
      // Skip invalid or unreadable files
    }
  }

  cachedSkills = skills;
  return cachedSkills;
}

/**
 * Updates analytics: increments trigger count for each skill name, and if no skills
 * matched, appends the user message to the zero-match list (keeps last 100).
 */
export function logSkillMatch(skillNames: string[], userMessage: string): void {
  for (const name of skillNames) {
    skillTriggerCounts.set(name, (skillTriggerCounts.get(name) ?? 0) + 1);
  }
  if (skillNames.length === 0 && userMessage.trim()) {
    zeroMatchMessages.push(userMessage.trim());
    if (zeroMatchMessages.length > ZERO_MATCH_CAP) {
      zeroMatchMessages.shift();
    }
  }
}

/**
 * Returns current skill trigger counts and the last 100 messages that matched zero skills.
 */
export function getSkillStats(): {
  counts: Record<string, number>;
  zeroMatchMessages: string[];
} {
  return {
    counts: Object.fromEntries(skillTriggerCounts),
    zeroMatchMessages: [...zeroMatchMessages],
  };
}

/**
 * Returns concatenated promptBlock text from all skills whose triggers match the
 * user message (case-insensitive, word-boundary). Multiple skills can match;
 * blocks are joined with double newline. Automatically logs the match for analytics.
 */
export function matchSkills(userMessage: string): string {
  const skills = loadAndCacheSkills();
  const message = userMessage ?? "";
  const promptSnippet = message.length > 60 ? message.slice(0, 60) + "…" : message;

  const blocks: string[] = [];
  const matchedNames: string[] = [];
  for (const skill of skills) {
    if (skill.alwaysLoad) {
      blocks.push(skill.promptBlock);
      matchedNames.push(skill.name);
      // DEBUG
      console.log(`[skill-match] Matched skill: ${skill.file} | Triggered by: alwaysLoad | prompt: '${promptSnippet}'`);
      continue;
    }
    const triggeringKeyword = skill.triggers.find((t, i) => skill.patterns[i]?.test(message));
    if (triggeringKeyword !== undefined) {
      blocks.push(skill.promptBlock);
      matchedNames.push(skill.name);
      // DEBUG
      console.log(`[skill-match] Matched skill: ${skill.file} | Triggered by keyword: '${triggeringKeyword}' in prompt: '${promptSnippet}'`);
    }
  }

  // DEBUG
  if (matchedNames.length === 0) {
    console.log(`[skill-match] No skills matched for prompt: '${promptSnippet}'`);
  }

  logSkillMatch(matchedNames, message);
  console.log("[skills] detected:", matchedNames.length ? matchedNames.join(", ") : "none");
  return blocks.join("\n\n");
}

/**
 * Returns the names of all skills that matched the user message (for logging).
 */
export function getMatchedSkillNames(userMessage: string): string[] {
  const skills = loadAndCacheSkills();
  const message = userMessage ?? "";

  return skills
    .filter((skill) => skill.alwaysLoad || skill.patterns.some((re) => re.test(message)))
    .map((skill) => skill.name);
}
