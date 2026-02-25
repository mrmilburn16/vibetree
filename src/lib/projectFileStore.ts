/**
 * In-memory + disk-backed store for generated Swift file contents per project.
 * Keyed by project id; each project has a map of path -> content.
 * Used after parsing structured LLM output; export reads from here.
 *
 * On setProjectFiles the data is written to .vibetree-cache/<projectId>.json
 * so files survive dev-server restarts. getProjectFiles hydrates from disk
 * when the in-memory entry is missing.
 */

import fs from "fs";
import path from "path";

export interface ProjectFiles {
  [filePath: string]: string;
}

const store = new Map<string, ProjectFiles>();

const CACHE_DIR = path.join(process.cwd(), ".vibetree-cache", "project-files");

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cachePath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

function persistToDisk(projectId: string, files: ProjectFiles): void {
  try {
    ensureCacheDir();
    fs.writeFileSync(cachePath(projectId), JSON.stringify(files), "utf-8");
  } catch {
    // disk write failure is non-fatal
  }
}

function loadFromDisk(projectId: string): ProjectFiles | undefined {
  try {
    const fp = cachePath(projectId);
    if (!fs.existsSync(fp)) return undefined;
    const raw = fs.readFileSync(fp, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ProjectFiles;
    }
  } catch {
    // corrupt cache — ignore
  }
  return undefined;
}

export function setProjectFiles(
  projectId: string,
  files: Array<{ path: string; content: string }>
): void {
  const next: ProjectFiles = {};
  for (const { path: filePath, content } of files) {
    if (filePath && typeof content === "string") {
      next[filePath] = content;
    }
  }
  store.set(projectId, next);
  persistToDisk(projectId, next);
}

export function getProjectFiles(projectId: string): ProjectFiles | undefined {
  const mem = store.get(projectId);
  if (mem) return mem;

  const disk = loadFromDisk(projectId);
  if (disk) {
    store.set(projectId, disk);
    return disk;
  }
  return undefined;
}

export function getProjectFile(
  projectId: string,
  filePath: string
): string | undefined {
  const files = getProjectFiles(projectId);
  return files?.[filePath];
}

/** All paths for a project, in insertion order (if we had it); otherwise Object.keys. */
export function getProjectFilePaths(projectId: string): string[] {
  const files = getProjectFiles(projectId);
  return files ? Object.keys(files) : [];
}
