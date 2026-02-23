export interface SkillDetection {
  /** Words/phrases that trigger this skill when found in the user prompt. */
  keywords: string[];
  /** If any of these appear, do NOT match this skill (disambiguation). */
  excludeKeywords: string[];
}

export interface SkillStats {
  totalBuilds: number;
  firstAttemptCompile: number;
  compileRate: number;
  functionalSuccesses: number;
  functionalRate: number;
  commonErrors: string[];
  /** File contents from successful first-attempt builds with high functional scores. */
  goldenExamples: Array<{
    buildResultId: string;
    timestamp: string;
    files: Record<string, string>;
  }>;
}

export interface Skill {
  id: string;
  name: string;
  frameworks: string[];
  version: number;
  detection: SkillDetection;
  /** Concise engineering guidance injected into the system prompt (200-800 tokens). */
  promptInjection: string;
  /** Tested, working Swift code patterns keyed by filename. */
  canonicalCode: Record<string, string>;
  /** Common mistakes the LLM makes with this framework. */
  antiPatterns: string[];
  /** Info.plist keys the build system should auto-add. */
  requiredPermissions: string[];
  stats: SkillStats;
}

export interface SkillMatch {
  skill: Skill;
  /** Number of keywords that matched the prompt. */
  matchCount: number;
  /** Matched keyword strings for debugging / logging. */
  matchedKeywords: string[];
}
