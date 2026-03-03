export interface ProjectRecord {
  id: string;
  name: string;
  bundleId: string;
  projectType?: "standard" | "pro";
  createdAt: number;
  updatedAt: number;
  /** Appetize public key (persisted); set by Mac runner after successful upload. */
  appetizePublicKey?: string | null;
}

const store = new Map<string, ProjectRecord>();

/** Exported so API can build project docs for Firestore-first create without mutating store. */
export function makeDefaultBundleId(id: string): string {
  const raw = id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  // Each dot-separated segment should start with a letter for best compatibility.
  const suffix = raw && /^[a-z]/.test(raw) ? raw : `app${raw || "project"}`;
  return `com.vibetree.${suffix}`.slice(0, 60);
}

export function getProject(id: string): ProjectRecord | undefined {
  return store.get(id);
}

/** Ensure a project exists in the store (e.g. client created it in localStorage only). Returns the project. */
export function ensureProject(
  id: string,
  name = "Untitled app",
  projectType: "standard" | "pro" = "pro"
): ProjectRecord {
  const existing = store.get(id);
  if (existing) return existing;
  const bundleId = makeDefaultBundleId(id);
  const now = Date.now();
  const project: ProjectRecord = { id, name, bundleId, projectType, createdAt: now, updatedAt: now };
  store.set(id, project);
  return project;
}

export function listProjects(): ProjectRecord[] {
  return Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Returns a display name unique among other projects (e.g. "To-Do List" -> "To-Do List (2)" if already used). */
export function uniquifyProjectName(projectId: string, name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return trimmed;
  const others = listProjects()
    .filter((p) => p.id !== projectId)
    .map((p) => p.name);
  if (!others.includes(trimmed)) return trimmed;
  const base = trimmed.replace(/\s*\(\d+\)\s*$/, "").trim() || trimmed;
  let n = 2;
  while (others.includes(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

export function createProject(name: string, projectType: "standard" | "pro" = "pro"): ProjectRecord {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const bundleId = makeDefaultBundleId(id);
  const now = Date.now();
  const project: ProjectRecord = { id, name, bundleId, projectType, createdAt: now, updatedAt: now };
  store.set(id, project);
  return project;
}

export function updateProject(
  id: string,
  updates: Partial<Pick<ProjectRecord, "name" | "bundleId" | "projectType" | "appetizePublicKey">>
): ProjectRecord | undefined {
  const project = store.get(id);
  if (!project) return undefined;
  Object.assign(project, updates, { updatedAt: Date.now() });
  store.set(id, project);
  return project;
}

export function deleteProject(id: string): boolean {
  if (!store.has(id)) return false;
  store.delete(id);
  return true;
}

/** Replace in-memory store with these records (e.g. after loading from Firestore). */
export function setProjects(records: ProjectRecord[]): void {
  store.clear();
  for (const r of records) {
    store.set(r.id, { ...r });
  }
}

/** Set a single project in the store (e.g. after loading from Firestore for GET /api/projects/[id]). */
export function setProject(record: ProjectRecord): void {
  store.set(record.id, { ...record });
}
