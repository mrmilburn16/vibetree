export interface ProjectRecord {
  id: string;
  name: string;
  bundleId: string;
  updatedAt: number;
}

const store = new Map<string, ProjectRecord>();

export function getProject(id: string): ProjectRecord | undefined {
  return store.get(id);
}

export function listProjects(): ProjectRecord[] {
  return Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createProject(name: string): ProjectRecord {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const bundleId = `com.vibetree.${id.replace("proj_", "").replace(/[^a-z0-9]/gi, "")}`.slice(0, 60);
  const project: ProjectRecord = { id, name, bundleId, updatedAt: Date.now() };
  store.set(id, project);
  return project;
}

export function updateProject(
  id: string,
  updates: Partial<Pick<ProjectRecord, "name" | "bundleId">>
): ProjectRecord | undefined {
  const project = store.get(id);
  if (!project) return undefined;
  Object.assign(project, updates, { updatedAt: Date.now() });
  store.set(id, project);
  return project;
}
