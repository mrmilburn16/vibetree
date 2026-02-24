import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const RULES_PATH = join(process.cwd(), "data", "qa-applied-rules.json");
const MAX_RULES = 25;

export interface AppliedRule {
  id: string;
  tag: string;
  description: string;
  rule: string;
  type: "prompt_rule" | "skill_update" | "fixswift_rule";
  affectedSkills: string[];
  active: boolean;
  appliedAt: string;
}

function ensureFile() {
  if (!existsSync(RULES_PATH)) {
    const dir = dirname(RULES_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(RULES_PATH, "[]", "utf8");
  }
}

export function loadAppliedRules(): AppliedRule[] {
  ensureFile();
  try {
    return JSON.parse(readFileSync(RULES_PATH, "utf8")) as AppliedRule[];
  } catch {
    return [];
  }
}

export function saveAppliedRules(rules: AppliedRule[]): void {
  ensureFile();
  writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + "\n", "utf8");
}

function generateRuleId(): string {
  return `qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(normalizeForComparison(a).split(" "));
  const wordsB = new Set(normalizeForComparison(b).split(" "));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export interface DuplicateCheck {
  isDuplicate: boolean;
  existingRule: AppliedRule | null;
  similarity: number;
}

/**
 * Check if a rule text is too similar to an existing applied rule.
 * Returns the most similar existing rule if similarity > 0.6.
 */
export function checkDuplicate(ruleText: string): DuplicateCheck {
  const existing = loadAppliedRules();
  let maxSim = 0;
  let bestMatch: AppliedRule | null = null;

  for (const rule of existing) {
    const sim = wordOverlap(ruleText, rule.rule);
    if (sim > maxSim) {
      maxSim = sim;
      bestMatch = rule;
    }
  }

  return {
    isDuplicate: maxSim > 0.6,
    existingRule: maxSim > 0.6 ? bestMatch : null,
    similarity: Math.round(maxSim * 100),
  };
}

export function applyRule(params: {
  tag: string;
  description: string;
  rule: string;
  type: "prompt_rule" | "skill_update" | "fixswift_rule";
  affectedSkills: string[];
}): { success: boolean; rule?: AppliedRule; error?: string } {
  const dupCheck = checkDuplicate(params.rule);
  if (dupCheck.isDuplicate && dupCheck.existingRule) {
    return {
      success: false,
      error: `Similar rule already exists (${dupCheck.similarity}% overlap): "${dupCheck.existingRule.description}"`,
    };
  }

  const rules = loadAppliedRules();

  const activeCount = rules.filter((r) => r.active).length;
  if (activeCount >= MAX_RULES) {
    const oldest = rules.filter((r) => r.active).sort((a, b) => a.appliedAt.localeCompare(b.appliedAt))[0];
    if (oldest) {
      oldest.active = false;
    }
  }

  const newRule: AppliedRule = {
    id: generateRuleId(),
    tag: params.tag,
    description: params.description,
    rule: params.rule,
    type: params.type,
    affectedSkills: params.affectedSkills,
    active: true,
    appliedAt: new Date().toISOString(),
  };

  rules.push(newRule);
  saveAppliedRules(rules);
  return { success: true, rule: newRule };
}

export function toggleRule(ruleId: string, active: boolean): AppliedRule | null {
  const rules = loadAppliedRules();
  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) return null;
  rule.active = active;
  saveAppliedRules(rules);
  return rule;
}

export function deleteRule(ruleId: string): boolean {
  const rules = loadAppliedRules();
  const idx = rules.findIndex((r) => r.id === ruleId);
  if (idx === -1) return false;
  rules.splice(idx, 1);
  saveAppliedRules(rules);
  return true;
}

/**
 * Build the prompt block from all active applied rules.
 * Appended to the system prompt at runtime.
 */
export function buildAppliedRulesPromptBlock(): string {
  const rules = loadAppliedRules().filter((r) => r.active);
  if (rules.length === 0) return "";

  const lines = rules.map((r) => `- ${r.description}: ${r.rule}`);
  return (
    "\n\n--- QA-DERIVED RULES (auto-applied from build testing feedback) ---\n" +
    lines.join("\n") +
    "\n--- END QA-DERIVED RULES ---"
  );
}
