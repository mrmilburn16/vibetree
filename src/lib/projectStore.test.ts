/**
 * Tests for projectStore: uniquifyProjectName ensures duplicate prompts get unique names (e.g. "To-Do List (2)").
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  setProjects,
  uniquifyProjectName,
  createProject,
  updateProject,
} from "@/lib/projectStore";

describe("uniquifyProjectName", () => {
  beforeEach(() => {
    setProjects([]);
  });

  it("returns the name unchanged when no other project has it", () => {
    const a = createProject("Untitled app");
    expect(uniquifyProjectName(a.id, "To-Do List")).toBe("To-Do List");
  });

  it("returns \"Name (2)\" when one other project has the same name", () => {
    const a = createProject("Untitled app");
    const b = createProject("Untitled app");
    updateProject(a.id, { name: "To-Do List" });
    expect(uniquifyProjectName(b.id, "To-Do List")).toBe("To-Do List (2)");
  });

  it("returns \"Name (3)\" when two others have Name and Name (2)", () => {
    const a = createProject("To-Do List");
    const b = createProject("To-Do List (2)");
    const c = createProject("Untitled app");
    expect(uniquifyProjectName(c.id, "To-Do List")).toBe("To-Do List (3)");
  });

  it("does not consider the current project when checking duplicates", () => {
    const a = createProject("To-Do List");
    expect(uniquifyProjectName(a.id, "To-Do List")).toBe("To-Do List");
  });

  it("trims and handles empty name", () => {
    const a = createProject("Untitled app");
    expect(uniquifyProjectName(a.id, "  ")).toBe("");
  });
});
