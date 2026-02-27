/**
 * Ensures the project name (e.g. "To Do List") appears in Recent Apps / project list
 * on both iOS and web, not "Untitled app", after a build completes with a derived title.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const IOS_CHAT_SERVICE = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Services/ChatService.swift"
);
const IOS_PROJECT_SERVICE = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Services/ProjectService.swift"
);
const IOS_PROJECT_LIST_VIEW = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/ProjectListView.swift"
);
const USE_CHAT = path.resolve(process.cwd(), "src/components/editor/useChat.ts");

describe("Project name in Recent Apps (iOS)", () => {
  it("ChatService updates ProjectService when PATCH succeeds so Recent Apps shows correct title", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toMatch(/ProjectService\.shared\.updateProjectName/);
    expect(content).toMatch(/updateProjectName\(id:\s*projectId/);
  });

  it("ProjectService has updateProjectName so list can show title without refetch", () => {
    const content = fs.readFileSync(IOS_PROJECT_SERVICE, "utf8");
    expect(content).toMatch(/func updateProjectName\(id:\s*String,\s*name:\s*String\)/);
    expect(content).toMatch(/projects\[idx\]\.name\s*=\s*name/);
  });

  it("ProjectListView displays project.name so updated name appears in Recent Apps", () => {
    const content = fs.readFileSync(IOS_PROJECT_LIST_VIEW, "utf8");
    expect(content).toMatch(/Text\(project\.name\)/);
  });
});

describe("Project name in Recent Apps / dashboard (web)", () => {
  it("useChat PATCHes project name and updates localStorage so dashboard can show correct title", () => {
    const content = fs.readFileSync(USE_CHAT, "utf8");
    expect(content).toContain("updateProjectNameInLocalStorage");
    expect(content).toMatch(/\/api\/projects\/\$\{projectId\}/);
    expect(content).toMatch(/method:\s*["']PATCH["']/);
    expect(content).toMatch(/deriveTitleFromPrompt|deriveTitleFromSummary/);
  });
});
