/**
 * Firestore persistence for project file contents.
 * Used so project files survive server restarts and are available when the client
 * does not send files (e.g. to avoid localStorage quota). One doc per project.
 * Doc size limit 1MB; large projects may need splitting in future.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "project_files";

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

export type ProjectFilesMap = Record<string, string>;

export async function getProjectFilesFromFirestore(projectId: string): Promise<ProjectFilesMap | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(projectId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    const files = data.files;
    if (!files || typeof files !== "object" || Array.isArray(files)) return null;
    return files as ProjectFilesMap;
  } catch {
    return null;
  }
}

export async function setProjectFilesInFirestore(
  projectId: string,
  files: ProjectFilesMap
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const updatedAt = Date.now();
    await db.collection(COLLECTION).doc(projectId).set({ updatedAt, files });
    return true;
  } catch (err) {
    console.warn("[projectFilesFirestore] set failed (doc may exceed 1MB):", err);
    return false;
  }
}
