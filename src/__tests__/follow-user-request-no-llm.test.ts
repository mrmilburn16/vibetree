/**
 * Verifies the pipeline respects user requests (e.g. "change background to orange") without calling the LLM.
 * 1. fixSwift must NOT overwrite user-requested colors (orange, purple, custom gradients).
 * 2. Prompt must instruct the model to apply explicit user requests and override defaults.
 * 3. Adapter must pass the user message through so the model sees "User request: <message>".
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";

const STRUCTURED_OUTPUT = path.resolve(process.cwd(), "src/lib/llm/structuredOutput.ts");
const CLAUDE_ADAPTER = path.resolve(process.cwd(), "src/lib/llm/claudeAdapter.ts");

describe("fixSwift: does NOT replace user-requested colors (orange, purple, custom)", () => {
  it("leaves Color.orange.ignoresSafeArea() unchanged so agent can set orange background", () => {
    const content = "ZStack { Color.orange.ignoresSafeArea()\nText(\"Hi\") }";
    const files = [{ path: "ContentView.swift", content }];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("Color.orange");
    expect(result[0].content).not.toContain("systemGray4");
    expect(result[0].content).not.toContain("secondarySystemBackground");
  });

  it("leaves LinearGradient with orange unchanged", () => {
    const content = "ZStack { LinearGradient(colors: [Color.orange, Color.orange.opacity(0.7)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()\nVStack { } }";
    const files = [{ path: "ContentView.swift", content }];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("Color.orange");
    expect(result[0].content).toContain("LinearGradient");
    expect(result[0].content).not.toMatch(/systemGray4|Color\(\s*\.systemBackground\s*\)/);
  });

  it("leaves Color.purple and other custom background colors unchanged", () => {
    const content = "ZStack { Color.purple.opacity(0.8).ignoresSafeArea()\nText(\"Counter\") }";
    const files = [{ path: "ContentView.swift", content }];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("Color.purple");
    expect(result[0].content).not.toContain("systemGray4");
  });

  it("only replaces black and systemBackground patterns, not arbitrary colors", () => {
    const withBlack = "ZStack { Color.black.ignoresSafeArea() }";
    const withOrange = "ZStack { Color.orange.ignoresSafeArea() }";
    const fixedBlack = fixSwiftCommonIssues([{ path: "A.swift", content: withBlack }]);
    const fixedOrange = fixSwiftCommonIssues([{ path: "B.swift", content: withOrange }]);
    expect(fixedBlack[0].content).toContain("LinearGradient"); // black was replaced
    expect(fixedOrange[0].content).toContain("Color.orange");   // orange left as-is
    expect(fixedOrange[0].content).not.toContain("LinearGradient");
  });
});

describe("Prompt: Follow user requests takes priority over default background", () => {
  it("Critical — Follow user requests appears before Critical — Background in prompt", () => {
    const content = fs.readFileSync(STRUCTURED_OUTPUT, "utf8");
    const followIdx = content.indexOf("Critical — Follow user requests");
    const backgroundIdx = content.indexOf("Critical — Background");
    expect(followIdx).toBeGreaterThanOrEqual(0);
    expect(backgroundIdx).toBeGreaterThanOrEqual(0);
    expect(followIdx).toBeLessThan(backgroundIdx);
  });

  it("Background rule explicitly says user color request overrides default", () => {
    const content = fs.readFileSync(STRUCTURED_OUTPUT, "utf8");
    expect(content).toMatch(/user explicitly requests a specific background color|change background to orange/);
    expect(content).toMatch(/apply the user's request|User requests override/);
  });

  it("claudeAdapter has same Follow user requests (any request: change word, add button, etc.)", () => {
    const content = fs.readFileSync(CLAUDE_ADAPTER, "utf8");
    expect(content).toContain("Critical — Follow user requests");
    expect(content).toMatch(/Whatever the user asks for|change a word|add a button/);
    expect(content).toMatch(/Do not return empty files|User requests override/);
  });
});

describe("Adapter: user message is passed through to the model", () => {
  it("builds userContent with 'User request:' plus the message so model sees exact request", () => {
    const content = fs.readFileSync(CLAUDE_ADAPTER, "utf8");
    expect(content).toContain("User request:");
    expect(content).toMatch(/\$\{message\}/);
  });

  it("when currentFiles present, userContent includes current files and then User request", () => {
    const content = fs.readFileSync(CLAUDE_ADAPTER, "utf8");
    expect(content).toContain("currentFiles");
    expect(content).toContain("User request:");
    expect(content).toMatch(/apply the user's request to these/);
  });

  it("when currentFiles present, userContent includes explicit instruction: apply only what user asked, return complete file(s), do not return same content unchanged", () => {
    const content = fs.readFileSync(CLAUDE_ADAPTER, "utf8");
    expect(content).toMatch(/Apply only what the user asked for|Apply only what was asked/);
    expect(content).toMatch(/complete updated file|Return the complete/);
    expect(content).toMatch(/Do not return the same content unchanged|user must see their requested change/);
  });
});
