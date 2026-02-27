/**
 * Ensures the LLM is instructed to avoid black backgrounds and to preserve app name on follow-ups.
 * System prompt has Critical rules; adapter injects "The app is already named X" when currentFiles + projectName.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const STRUCTURED_OUTPUT = path.resolve(process.cwd(), "src/lib/llm/structuredOutput.ts");
const CLAUDE_ADAPTER = path.resolve(process.cwd(), "src/lib/llm/claudeAdapter.ts");
const MESSAGE_ROUTE = path.resolve(process.cwd(), "src/app/api/projects/[id]/message/route.ts");

describe("System prompt: Critical background and app name rules", () => {
  it("structuredOutput SYSTEM_PROMPT_SWIFT includes Critical — Background (no Color.black)", () => {
    const content = fs.readFileSync(STRUCTURED_OUTPUT, "utf8");
    expect(content).toContain("Critical — Background");
    expect(content).toMatch(/Do NOT use Color\.black|Color\.black.*main screen/);
    expect(content).toMatch(/systemBackground|\.systemBackground/);
  });

  it("structuredOutput SYSTEM_PROMPT_SWIFT includes Critical — App name (do not rename)", () => {
    const content = fs.readFileSync(STRUCTURED_OUTPUT, "utf8");
    expect(content).toContain("Critical — App name");
    expect(content).toMatch(/already named|Do not change the app name|do not rename/);
  });

  it("claudeAdapter SYSTEM_PROMPT_SWIFT includes same Critical rules", () => {
    const content = fs.readFileSync(CLAUDE_ADAPTER, "utf8");
    expect(content).toContain("Critical — Background");
    expect(content).toContain("Critical — App name");
    expect(content).toMatch(/Do NOT use Color\.black/);
  });
});

describe("Adapter: projectName and preserve-name instruction on follow-up", () => {
  it("claudeAdapter builds userContent with preserveName when currentFiles and projectName", () => {
    const content = fs.readFileSync(CLAUDE_ADAPTER, "utf8");
    expect(content).toContain("projectName");
    expect(content).toMatch(/The app is already named|preserveName/);
    expect(content).toMatch(/options\.projectName|projectName\.trim\(\)/);
    expect(content).toContain("currentFiles");
    expect(content).toMatch(/preserveName\s*=/);
  });

  it("message route passes projectName when currentFiles exist", () => {
    const content = fs.readFileSync(MESSAGE_ROUTE, "utf8");
    expect(content).toMatch(/projectName:\s*currentFiles\s*\?\s*project\.name/);
  });
});
