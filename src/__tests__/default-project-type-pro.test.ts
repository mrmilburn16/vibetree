/**
 * Ensures the default project type is Pro (Swift) everywhere so restarts and
 * fresh sessions use Swift, not Standard (Expo).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CHAT_PANEL = path.resolve(process.cwd(), "src/components/editor/ChatPanel.tsx");
const DASHBOARD = path.resolve(process.cwd(), "src/app/dashboard/page.tsx");
const API_PROJECTS = path.resolve(process.cwd(), "src/app/api/projects/route.ts");
const MOCK_ADAPTER = path.resolve(process.cwd(), "src/lib/llm/mockAdapter.ts");
const IOS_CHAT_PANEL = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/ChatPanelView.swift"
);

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("Default project type is Pro (Swift)", () => {
  it("ChatPanel (web editor) defaults to pro when no localStorage", () => {
    const content = read(CHAT_PANEL);
    expect(content).toMatch(/return\s*["']pro["']/);
    expect(content).toMatch(/localStorage\.setItem\(PROJECT_TYPE_STORAGE_KEY,\s*["']pro["']\)/);
    const initSection = content.slice(
      content.indexOf("useState<\"standard\" | \"pro\">(() =>"),
      content.indexOf("return \"pro\"") + 20
    );
    expect(initSection).toContain('return "pro"');
  });

  it("Dashboard defaults to pro and persists to localStorage when missing", () => {
    const content = read(DASHBOARD);
    expect(content).toMatch(/useState.*["']pro["']\)/);
    expect(content).toMatch(/localStorage\.setItem\(PROJECT_TYPE_STORAGE_KEY,\s*["']pro["']\)/);
  });

  it("POST /api/projects defaults projectType to pro when body.projectType missing", () => {
    const content = read(API_PROJECTS);
    expect(content).toMatch(/body\.projectType\s*===\s*["']pro["']/);
    expect(content).toMatch(/: ["']pro["']\s*;?\s*$/m);
    expect(content).not.toMatch(/body\.projectType\s*!==\s*["']pro["'].*["']standard["']\s*;?\s*$/m);
    const projectTypeBlock = content.slice(
      content.indexOf("const projectType ="),
      content.indexOf("const project = id ? ensureProject")
    );
    expect(projectTypeBlock).toMatch(/\?\s*["']pro["']\s*:/);
    expect(projectTypeBlock).toMatch(/:\s*["']pro["']\s*;?/);
  });

  it("mockAdapter default projectType parameter is pro", () => {
    const content = read(MOCK_ADAPTER);
    expect(content).toMatch(/projectType:.*=\s*["']pro["']/);
  });

  it("iOS ChatPanelView selectedProjectType state defaults to .pro", () => {
    const content = read(IOS_CHAT_PANEL);
    expect(content).toMatch(/selectedProjectType:?\s*ProjectType\s*=\s*\.pro/);
  });
});
