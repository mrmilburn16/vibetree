export interface Project {
  id: string;
  name: string;
  bundleId: string;
  updatedAt: number;
}

const STORAGE_KEY = "vibetree-projects";

export function getProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createProject(name?: string): Project {
  const projects = getProjects();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const project: Project = {
    id,
    name: name || "Untitled app",
    bundleId: `com.vibetree.${id.replace("proj_", "").replace(/[^a-z0-9]/gi, "")}`.slice(0, 60),
    updatedAt: Date.now(),
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
