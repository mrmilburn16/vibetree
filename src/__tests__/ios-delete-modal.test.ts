/**
 * Ensures the iOS app uses the same delete confirmation as the web: a modal/sheet
 * that requires the user to type "DELETE" to confirm before the app is deleted.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_LIST_VIEW = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/ProjectListView.swift"
);
const DASHBOARD_PAGE = path.resolve(process.cwd(), "src/app/dashboard/page.tsx");

describe("Delete app: same confirmation as web (type DELETE)", () => {
  it("web dashboard requires typing DELETE to confirm", () => {
    const content = fs.readFileSync(DASHBOARD_PAGE, "utf8");
    expect(content).toContain("CONFIRM_DELETE_TEXT");
    expect(content).toMatch(/DELETE|CONFIRM_DELETE_TEXT/);
    expect(content).toMatch(/disabled=\{.*deleteConfirmInput.*CONFIRM_DELETE_TEXT|disabled=\{.*!==.*CONFIRM_DELETE_TEXT/);
    expect(content).toMatch(/Type.*confirm|placeholder=\{CONFIRM_DELETE_TEXT\}/);
  });

  it("iOS ProjectListView shows delete sheet and requires typing DELETE", () => {
    const content = fs.readFileSync(PROJECT_LIST_VIEW, "utf8");
    expect(content).toContain("deleteConfirmText");
    expect(content).toMatch(/deleteConfirmText.*=.*\"DELETE\"|"DELETE"/);
    expect(content).toMatch(/deleteTargetProject|deleteConfirmInput/);
    expect(content).toMatch(/canDelete|deleteConfirmText|confirmInput\.wrappedValue/);
    expect(content).toMatch(/\.disabled\(!canDelete\)|disabled.*canDelete/);
  });

  it("iOS delete sheet has same copy as web: permanent delete, type to confirm", () => {
    const content = fs.readFileSync(PROJECT_LIST_VIEW, "utf8");
    expect(content).toContain("Delete app");
    expect(content).toContain("permanently delete");
    expect(content).toContain("This cannot be undone");
    expect(content).toMatch(/Type.*to confirm|deleteConfirmText.*to confirm/);
  });

  it("iOS context menu sets deleteTargetProject to open sheet; delete only in onConfirm", () => {
    const content = fs.readFileSync(PROJECT_LIST_VIEW, "utf8");
    expect(content).toMatch(/deleteTargetProject\s*=\s*project/);
    expect(content).toContain("onConfirm:");
    expect(content).toContain("service.deleteProject(id:");
  });
});
