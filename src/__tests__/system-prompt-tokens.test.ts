/**
 * Verifies system prompt token breakdown and provides a way to measure full prompt size
 * (base + skillPromptBlock + qaRulesBlock + integrationsBlock).
 */
import { describe, it, expect } from "vitest";
import {
  getSystemPromptTokenBreakdown,
  estimatePromptTokens,
  type SystemPromptTokenBreakdown,
} from "@/lib/llm/claudeAdapter";

describe("System prompt token estimation", () => {
  it("estimatePromptTokens uses ~4 chars per token heuristic", () => {
    expect(estimatePromptTokens("")).toBe(0);
    expect(estimatePromptTokens("abcd")).toBe(1);
    expect(estimatePromptTokens("hello world")).toBe(3);
  });

  it("getSystemPromptTokenBreakdown returns shape and Pro base prompt is ~9k tokens", () => {
    const breakdown = getSystemPromptTokenBreakdown({ projectType: "pro" });
    expect(breakdown).toMatchObject({
      totalChars: expect.any(Number),
      totalTokensEstimate: expect.any(Number),
      basePrompt: { chars: expect.any(Number), tokensEstimate: expect.any(Number) },
      skillPromptBlock: { chars: expect.any(Number), tokensEstimate: expect.any(Number) },
      qaRulesBlock: { chars: expect.any(Number), tokensEstimate: expect.any(Number) },
      integrationsBlock: { chars: expect.any(Number), tokensEstimate: expect.any(Number) },
    });
    expect(breakdown.totalChars).toBe(
      breakdown.basePrompt.chars +
        breakdown.skillPromptBlock.chars +
        breakdown.qaRulesBlock.chars +
        breakdown.integrationsBlock.chars
    );
    // SYSTEM_PROMPT_SWIFT base (after moving sections to skills) is ~24k chars / ~6k tokens
    expect(breakdown.basePrompt.tokensEstimate).toBeGreaterThanOrEqual(5000);
    expect(breakdown.basePrompt.tokensEstimate).toBeLessThanOrEqual(7500);

    // Log breakdown when test runs (for monitoring prompt size)
    logBreakdown("Pro (no skill block)", breakdown);
  });

  it("getSystemPromptTokenBreakdown with skill block adds to total", () => {
    const extra = "--- CAPABILITY: Test ---\nUse SwiftUI.";
    const without = getSystemPromptTokenBreakdown({ projectType: "pro" });
    const withSkill = getSystemPromptTokenBreakdown({
      projectType: "pro",
      skillPromptBlock: extra,
    });
    expect(withSkill.totalChars).toBe(without.totalChars + extra.length);
    expect(withSkill.skillPromptBlock.chars).toBe(extra.length);
    logBreakdown("Pro (with skill block)", withSkill);
  });
});

function logBreakdown(label: string, b: SystemPromptTokenBreakdown) {
  const lines = [
    `${label}:`,
    `  basePrompt:        ${b.basePrompt.chars.toLocaleString()} chars  ~${b.basePrompt.tokensEstimate.toLocaleString()} tokens`,
    `  skillPromptBlock:  ${b.skillPromptBlock.chars.toLocaleString()} chars  ~${b.skillPromptBlock.tokensEstimate.toLocaleString()} tokens`,
    `  qaRulesBlock:      ${b.qaRulesBlock.chars.toLocaleString()} chars  ~${b.qaRulesBlock.tokensEstimate.toLocaleString()} tokens`,
    `  integrationsBlock: ${b.integrationsBlock.chars.toLocaleString()} chars  ~${b.integrationsBlock.tokensEstimate.toLocaleString()} tokens`,
    `  TOTAL:             ${b.totalChars.toLocaleString()} chars  ~${b.totalTokensEstimate.toLocaleString()} tokens`,
  ];
  // eslint-disable-next-line no-console
  console.log("\n" + lines.join("\n"));
}
