/**
 * Ensures deleting a project on one device removes it for all devices:
 * DELETE /api/projects/:id updates the server (projectStore + Firestore),
 * so when web or iOS next fetches GET /api/projects they get the same list without the project.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getProjectsList } from "@/app/api/projects/route";
import { GET as getProject, DELETE as deleteProject } from "@/app/api/projects/[id]/route";
import { setProjects } from "@/lib/projectStore";

vi.mock("@/lib/projectsFirestore", () => ({
  listProjectsFromFirestore: vi.fn().mockResolvedValue({ projects: [], fromFirestore: false }),
  createProjectInFirestore: vi.fn().mockResolvedValue(true),
  updateProjectInFirestore: vi.fn().mockResolvedValue(true),
  deleteProjectFromFirestore: vi.fn().mockResolvedValue(true),
}));

describe("Project delete sync (both devices)", () => {
  const projectId = "proj_delete_sync_test_123";
  const project = {
    id: projectId,
    name: "Delete sync test app",
    bundleId: "com.vibetree.deletesynctest",
    projectType: "pro" as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    setProjects([project]);
  });

  it("GET /api/projects returns the project before delete", async () => {
    const res = await getProjectsList();
    expect(res.status).toBe(200);
    const data = await res.json();
    const ids = (data.projects ?? []).map((p: { id: string }) => p.id);
    expect(ids).toContain(projectId);
  });

  it("GET /api/projects excludes the project after DELETE /api/projects/:id", async () => {
    const deleteRes = await deleteProject(new Request("http://test/api/projects/" + projectId, { method: "DELETE" }), {
      params: Promise.resolve({ id: projectId }),
    });
    expect(deleteRes.status).toBe(204);

    const listRes = await getProjectsList();
    expect(listRes.status).toBe(200);
    const data = await listRes.json();
    const ids = (data.projects ?? []).map((p: { id: string }) => p.id);
    expect(ids).not.toContain(projectId);
  });

  it("GET /api/projects/:id returns 404 after delete", async () => {
    await deleteProject(new Request("http://test/api/projects/" + projectId, { method: "DELETE" }), {
      params: Promise.resolve({ id: projectId }),
    });

    const getRes = await getProject(new Request("http://test"), { params: Promise.resolve({ id: projectId }) });
    expect(getRes.status).toBe(404);
  });

  it("delete on web → iOS recent apps list does not show deleted project (GET after DELETE)", async () => {
    const beforeRes = await getProjectsList();
    const beforeData = await beforeRes.json();
    const beforeIds = (beforeData.projects ?? []).map((p: { id: string }) => p.id);
    expect(beforeIds).toContain(projectId);

    await deleteProject(new Request("http://test/api/projects/" + projectId, { method: "DELETE" }), {
      params: Promise.resolve({ id: projectId }),
    });

    const afterRes = await getProjectsList();
    const afterData = await afterRes.json();
    const afterIds = (afterData.projects ?? []).map((p: { id: string }) => p.id);
    expect(afterIds).not.toContain(projectId);
    expect(afterIds.length).toBe(beforeIds.length - 1);
  });
});

describe("PATCH project name uniquification", () => {
  const idA = "proj_uniq_a";
  const idB = "proj_uniq_b";

  beforeEach(() => {
    setProjects([
      {
        id: idA,
        name: "To-Do List",
        bundleId: "com.vibetree.a",
        projectType: "pro",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: idB,
        name: "Untitled app",
        bundleId: "com.vibetree.b",
        projectType: "pro",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
  });

  it("PATCH with duplicate name returns uniquified name (2)", async () => {
    const { PATCH } = await import("@/app/api/projects/[id]/route");
    const res = await PATCH(
      new Request("http://test/api/projects/" + idB, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "To-Do List" }),
      }),
      { params: Promise.resolve({ id: idB }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("To-Do List (2)");
  });
});
