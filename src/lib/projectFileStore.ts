/**
 * In-memory store for generated Swift file contents per project.
 * Keyed by project id; each project has a map of path -> content.
 * Used after parsing structured LLM output; export reads from here.
 */

export interface ProjectFiles {
  [path: string]: string;
}

const store = new Map<string, ProjectFiles>();

export function setProjectFiles(
  projectId: string,
  files: Array<{ path: string; content: string }>
): void {
  const next: ProjectFiles = {};
  for (const { path, content } of files) {
    if (path && typeof content === "string") {
      next[path] = content;
    }
  }
  store.set(projectId, next);
}

export function getProjectFiles(projectId: string): ProjectFiles | undefined {
  return store.get(projectId);
}

export function getProjectFile(
  projectId: string,
  path: string
): string | undefined {
  const files = store.get(projectId);
  return files?.[path];
}

/** All paths for a project, in insertion order (if we had it); otherwise Object.keys. */
export function getProjectFilePaths(projectId: string): string[] {
  const files = store.get(projectId);
  return files ? Object.keys(files) : [];
}
