export interface ProjectRecord {
  id: string;
  name: string;
  bundleId: string;
  updatedAt: number;
}

const store = new Map<string, ProjectRecord>();

function makeDefaultBundleId(id: string): string {
  const raw = id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  // Each dot-separated segment should start with a letter for best compatibility.
  const suffix = raw && /^[a-z]/.test(raw) ? raw : `app${raw || "project"}`;
  return `com.vibetree.${suffix}`.slice(0, 60);
}

export function getProject(id: string): ProjectRecord | undefined {
  return store.get(id);
}

/** Ensure a project exists in the store (e.g. client created it in localStorage only). Returns the project. */
export function ensureProject(id: string, name = "Untitled app"): ProjectRecord {
  const existing = store.get(id);
  if (existing) return existing;
  const bundleId = makeDefaultBundleId(id);
  const project: ProjectRecord = { id, name, bundleId, updatedAt: Date.now() };
  store.set(id, project);
  return project;
}

export function listProjects(): ProjectRecord[] {
  return Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createProject(name: string): ProjectRecord {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const bundleId = makeDefaultBundleId(id);
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
