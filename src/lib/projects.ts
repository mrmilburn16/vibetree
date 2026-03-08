export interface Project {
  id: string;
  name: string;
  bundleId: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "vibetree-projects";

/** Minimal cache shape: only id and name to avoid quota. Full data comes from API. */
type CachedProject = { id: string; name: string };

function makeDefaultBundleId(id: string): string {
  const raw = id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = raw && /^[a-z]/.test(raw) ? raw : `app${raw || "project"}`;
  return `com.vibetree.${suffix}`.slice(0, 60);
}

export function getProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.map((p: unknown) => {
      const o = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
      const id = typeof o.id === "string" ? o.id : "";
      const name = typeof o.name === "string" ? o.name : "Untitled app";
      return {
        id,
        name,
        bundleId: makeDefaultBundleId(id),
        createdAt: typeof o.createdAt === "number" ? o.createdAt : Date.now(),
        updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : Date.now(),
      };
    });
  } catch {
    return [];
  }
}

/** Cache only id and name (localStorage is just a cache; API is source of truth). Silently ignores QuotaExceededError. */
export function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  const cache: CachedProject[] = projects.map((p) => ({ id: p.id, name: p.name }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // QuotaExceededError or other; don't crash the flow — dashboard still shows API data
  }
}

export function createProject(name?: string): Project {
  const projects = getProjects();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const project: Project = {
    id,
    name: name || "Untitled app",
    bundleId: makeDefaultBundleId(id),
    createdAt: now,
    updatedAt: now,
  };
  projects.unshift(project);
  saveProjects(projects);
  return project;
}

export function getProject(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}

export function updateProject(id: string, updates: Partial<Pick<Project, "name" | "bundleId">>): void {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return;
  projects[idx] = { ...projects[idx], ...updates, updatedAt: Date.now() };
  saveProjects(projects);
}

export function deleteProject(id: string): void {
  const projects = getProjects().filter((p) => p.id !== id);
  saveProjects(projects);
}

export function duplicateProject(id: string): Project | undefined {
  const project = getProject(id);
  if (!project) return undefined;
  const copy = createProject(`${project.name} (copy)`);
  return getProject(copy.id);
}
