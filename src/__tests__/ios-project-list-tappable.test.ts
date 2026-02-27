/**
 * Ensures the recent apps list on iOS allows opening an app by tapping anywhere on the row,
 * not only on the chevron. ProjectListView must use a Button wrapping the full row and
 * contentShape(Rectangle()) on the row content so the entire entry is hit-testable.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_LIST_VIEW = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/ProjectListView.swift"
);

describe("iOS recent apps: full row opens app (not just chevron)", () => {
  it("project list uses Button wrapping projectRow so row tap navigates", () => {
    const content = fs.readFileSync(PROJECT_LIST_VIEW, "utf8");
    expect(content).toMatch(/Button\s*\{[^}]*pendingPrompt = nil[^}]*navigateToProject = project/);
    expect(content).toMatch(/label:\s*\{\s*projectRow\(project\)/);
  });

  it("projectRow applies contentShape(Rectangle()) so entire row is tappable", () => {
    const content = fs.readFileSync(PROJECT_LIST_VIEW, "utf8");
    expect(content).toContain(".contentShape(Rectangle())");
    const projectRowSection = content.includes("private func projectRow")
      ? content.slice(content.indexOf("private func projectRow"))
      : content;
    expect(projectRowSection).toMatch(/\.contentShape\(Rectangle\(\)\)/);
  });

  it("Button has contentShape or row content does so spacer area is hit-testable", () => {
    const content = fs.readFileSync(PROJECT_LIST_VIEW, "utf8");
    const contentShapeCount = (content.match(/\.contentShape\(Rectangle\(\)\)/g) ?? []).length;
    expect(contentShapeCount).toBeGreaterThanOrEqual(1);
  });
});
