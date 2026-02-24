import { describe, it, expect, beforeEach } from "vitest";
import {
  createProject,
  getProject,
  ensureProject,
  listProjects,
  updateProject,
} from "../projectStore";

describe("projectStore", () => {
  it("creates a project with generated id", () => {
    const project = createProject("Test App");
    expect(project.id).toMatch(/^proj_/);
    expect(project.name).toBe("Test App");
    expect(project.bundleId).toMatch(/^com\.vibetree\./);
    expect(project.createdAt).toBeGreaterThan(0);
    expect(project.updatedAt).toBe(project.createdAt);
  });

  it("retrieves a created project by id", () => {
    const project = createProject("Lookup App");
    const found = getProject(project.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Lookup App");
  });

  it("returns undefined for unknown id", () => {
    expect(getProject("nonexistent_id")).toBeUndefined();
  });

  it("lists all created projects", () => {
    const a = createProject("App A");
    const b = createProject("App B");
    const list = listProjects();
    const ids = list.map((p) => p.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it("ensureProject creates if not exists", () => {
    const id = `proj_ensure_${Date.now()}`;
    const project = ensureProject(id, "Ensured App");
    expect(project.name).toBe("Ensured App");
    expect(getProject(id)).toBeDefined();
  });

  it("ensureProject returns existing if already exists", () => {
    const created = createProject("Existing");
    const ensured = ensureProject(created.id, "Different Name");
    expect(ensured.name).toBe("Existing");
  });

  it("updates project name and bundleId", () => {
    const project = createProject("Original");
    const updated = updateProject(project.id, {
      name: "Renamed",
      bundleId: "com.test.renamed",
    });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe("Renamed");
    expect(updated!.bundleId).toBe("com.test.renamed");
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(project.updatedAt);
  });

  it("updateProject returns undefined for unknown id", () => {
    expect(updateProject("nope", { name: "X" })).toBeUndefined();
  });
});
