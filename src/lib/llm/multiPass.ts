/**
 * Multi-pass generation pipeline for complex apps.
 * Phase 4 from QUALITY_IMPROVEMENT_PLAN.md.
 *
 * For simple apps (1-2 files): single pass (existing behavior).
 * For medium apps (3-5 files): implementation + self-review.
 * For hard apps (6+ files): architecture plan → implementation → self-review.
 */

import type { CodeFile, ProjectType } from "@/types";

export type AppComplexity = "simple" | "medium" | "hard";

export interface ArchitecturePlan {
  screens: string[];
  models: string[];
  navigation: "tab" | "stack" | "single" | "mixed";
  files: string[];
}

export interface MultiPassConfig {
  complexity: AppComplexity;
  skipArchitecturePass: boolean;
  skipSelfReview: boolean;
  maxFiles: number;
}

/**
 * Estimate app complexity from the user's prompt.
 * Used to decide how many passes to run.
 */
export function estimateComplexity(prompt: string): AppComplexity {
  const lower = prompt.toLowerCase();

  const hardIndicators = [
    /\b(multi[- ]?screen|multiple\s+screens?|several\s+screens?)\b/,
    /\b(tab\s*bar|tab\s*view|tabs)\b/,
    /\b(database|core\s*data|persistence|sqlite)\b/,
    /\b(login|sign[\s-]?in|auth|account)\b.*\b(screen|page|view)\b/,
    /\b(search|filter|sort)\b.*\b(and|with)\b.*\b(search|filter|sort)\b/,
    /\b(settings|profile|dashboard)\b.*\b(and|with)\b/,
    /\b(at\s+least\s+|more\s+than\s+)?\d+\s+(screen|page|view|tab)s?\b/,
    /\b(complex|advanced|full[- ]?featured|complete|comprehensive)\b/,
    /\bnavigation\b.*\b(between|across)\b.*\b(screen|page|view)s?\b/,
  ];

  const mediumIndicators = [
    /\b(list|detail|edit|form|modal)\b.*\b(view|screen|page|editing)\b/,
    /\b(save|store|persist|remember)\b/,
    /\b(two|2|three|3)\s+(screen|page|view)s?\b/,
    /\b(crud|create|read|update|delete)\b/i,
    /\b(chart|graph|visualization)\b/,
    /\b(timer|stopwatch|countdown)\b/,
    /\b(camera|photo|image)\b.*\b(and|with)\b/,
    /\b(list)\b.*\b(detail)\b/,
    /\b(stopwatch)\b.*\b(countdown)\b/,
    /\b(countdown)\b.*\b(stopwatch)\b/,
  ];

  let hardScore = 0;
  for (const re of hardIndicators) {
    if (re.test(lower)) hardScore++;
  }
  if (hardScore >= 2) return "hard";

  let mediumScore = 0;
  for (const re of mediumIndicators) {
    if (re.test(lower)) mediumScore++;
  }
  if (mediumScore >= 2 || hardScore >= 1) return "medium";

  return "simple";
}

/**
 * Get the multi-pass configuration for a given complexity level.
 */
export function getMultiPassConfig(complexity: AppComplexity): MultiPassConfig {
  switch (complexity) {
    case "hard":
      return {
        complexity,
        skipArchitecturePass: false,
        skipSelfReview: false,
        maxFiles: 20,
      };
    case "medium":
      return {
        complexity,
        skipArchitecturePass: true,
        skipSelfReview: false,
        maxFiles: 10,
      };
    case "simple":
    default:
      return {
        complexity,
        skipArchitecturePass: true,
        skipSelfReview: true,
        maxFiles: 5,
      };
  }
}

/**
 * Build the architecture planning prompt (Pass 1).
 * Asks the LLM to output a JSON plan, not code.
 */
export function buildArchitecturePrompt(
  userPrompt: string,
  projectType: ProjectType
): string {
  const fileExt = projectType === "pro" ? ".swift" : ".js";
  return `The user wants to build this app: "${userPrompt}"

Before writing any code, plan the architecture. Respond with a JSON object ONLY:
{
  "screens": ["list of screen/view names"],
  "models": ["list of data model names"],
  "navigation": "tab" | "stack" | "single" | "mixed",
  "files": ["App${fileExt}", "Views/HomeView${fileExt}", "Models/Item${fileExt}", ...]
}

Rules:
- List every file that will be needed
- Use proper folder structure: Views/, Models/, ViewModels/ for complex apps
- Every screen must be reachable via navigation
- Include the App entry file
- No code — just the plan`;
}

/**
 * Build the self-review prompt (Pass 3).
 * Asks the LLM to review generated code for common issues.
 */
export function buildSelfReviewPrompt(
  files: CodeFile[],
  projectType: ProjectType
): string {
  const fileList = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const lang = projectType === "pro" ? "SwiftUI" : "React Native";

  return `Review this ${lang} project for issues. Fix any problems you find and return the corrected files.

Check for:
- Missing button actions (empty closures or TODO comments)
- Navigation bugs (NavigationLink without NavigationStack, orphaned views)
- Layout overlaps (ZStack misuse, .offset positioning)
- Missing imports
- Type errors
- Missing empty states (blank screens when no data)
- Missing loading states (no ProgressView during async work)
- Unreachable views (defined but never instantiated)
- Data flow issues (data created in one screen but not passed to another)

Return the full corrected files as JSON: { "summary": "what you fixed", "files": [...] }
If no issues found, return the original files unchanged with summary "No issues found".

Current files:
${fileList}`;
}

/**
 * Parse an architecture plan response from the LLM.
 */
export function parseArchitecturePlan(raw: string): ArchitecturePlan | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned);
    if (
      Array.isArray(parsed.screens) &&
      Array.isArray(parsed.files) &&
      typeof parsed.navigation === "string"
    ) {
      return {
        screens: parsed.screens,
        models: Array.isArray(parsed.models) ? parsed.models : [],
        navigation: parsed.navigation,
        files: parsed.files,
      };
    }
    return null;
  } catch {
    return null;
  }
}
