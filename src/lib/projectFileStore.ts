/**
 * In-memory + disk + Firestore store for generated Swift file contents per project.
 * Keyed by project id; each project has a map of path -> content.
 * Used after parsing structured LLM output; export reads from here.
 *
 * - setProjectFiles: writes to memory, .vibetree-cache/<projectId>.json, and Firestore.
 * - getProjectFiles: reads from memory; if missing, disk; if missing, Firestore (async hydrate).
 */

import fs from "fs";
import path from "path";
import {
  getProjectFilesFromFirestore,
  setProjectFilesInFirestore,
} from "@/lib/projectFilesFirestore";

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
  console.log('[setProjectFiles] Saving', files.length, 'files for project', projectId, '| paths:', files.map(f => f.path).join(', '));
  store.set(projectId, next);
  persistToDisk(projectId, next);
  setProjectFilesInFirestore(projectId, next).then((ok) => {
    if (!ok) {
      console.warn('[setProjectFiles] Firestore write returned false for project', projectId, '(doc may exceed 1MB or Firebase is unavailable)');
    } else {
      console.log('[setProjectFiles] Firestore write OK for project', projectId);
    }
  }).catch((err) => {
    console.error('[setProjectFiles] Firestore write THREW for project', projectId, ':', err instanceof Error ? err.message : String(err));
  });
}

/** Pending Firestore hydrations so we don't duplicate in-flight requests. */
const firestoreHydrating = new Set<string>();

export function getProjectFiles(projectId: string): ProjectFiles | undefined {
  const mem = store.get(projectId);
  if (mem) return mem;
  const disk = loadFromDisk(projectId);
  if (disk) {
    store.set(projectId, disk);
    return disk;
  }
  if (!firestoreHydrating.has(projectId)) {
    firestoreHydrating.add(projectId);
    getProjectFilesFromFirestore(projectId).then((fromFirestore) => {
      firestoreHydrating.delete(projectId);
      if (fromFirestore && Object.keys(fromFirestore).length > 0) {
        store.set(projectId, fromFirestore);
        persistToDisk(projectId, fromFirestore);
      }
    }).catch(() => { firestoreHydrating.delete(projectId); });
  }
  return undefined;
}

/**
 * Async version of setProjectFiles that awaits the Firestore write and surfaces any error.
 * Use in API routes where you need to guarantee the write completes before returning.
 */
export async function setProjectFilesAsync(
  projectId: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  const next: ProjectFiles = {};
  for (const { path: filePath, content } of files) {
    if (filePath && typeof content === "string") {
      next[filePath] = content;
    }
  }
  console.log('[setProjectFilesAsync] Saving', files.length, 'files for project', projectId, '| paths:', files.map(f => f.path).join(', '));
  store.set(projectId, next);
  persistToDisk(projectId, next);
  const ok = await setProjectFilesInFirestore(projectId, next).catch((err) => {
    console.error('[setProjectFilesAsync] Firestore write THREW for project', projectId, ':', err instanceof Error ? err.message : String(err));
    return false;
  });
  if (!ok) {
    console.warn('[setProjectFilesAsync] Firestore write returned false for project', projectId);
  } else {
    console.log('[setProjectFilesAsync] Firestore write OK for project', projectId);
  }
}

/** Async version that waits for Firestore if needed. Use when caller can await (e.g. API routes). */
export async function getProjectFilesAsync(projectId: string): Promise<ProjectFiles | undefined> {
  const mem = store.get(projectId);
  if (mem) return mem;
  const disk = loadFromDisk(projectId);
  if (disk) {
    store.set(projectId, disk);
    return disk;
  }
  const fromFirestore = await getProjectFilesFromFirestore(projectId);
  if (fromFirestore && Object.keys(fromFirestore).length > 0) {
    store.set(projectId, fromFirestore);
    persistToDisk(projectId, fromFirestore);
    return fromFirestore;
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
