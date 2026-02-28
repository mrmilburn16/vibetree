/**
 * Firestore persistence for projects. Syncs project list so web and iOS stay in sync.
 * When Firebase env vars are missing, all functions no-op or return empty so the app still runs.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

export interface ProjectDoc {
  id: string;
  name: string;
  bundleId: string;
  projectType: "standard" | "pro";
  createdAt: number;
  updatedAt: number;
  /** Appetize public key (persisted); set by Mac runner after successful upload. */
  appetizePublicKey?: string | null;
}

const COLLECTION = "projects";

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

/** Fetch a single project by id (e.g. for appetize key when in-memory store not yet populated). */
export async function getProjectFromFirestore(id: string): Promise<ProjectDoc | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    const appetizePublicKey = data.appetizePublicKey;
    return {
      id: (data.id as string) || snap.id,
      name: (data.name as string) || "Untitled app",
      bundleId: (data.bundleId as string) || "",
      projectType: (data.projectType === "standard" ? "standard" : "pro") as "standard" | "pro",
      createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
      appetizePublicKey: typeof appetizePublicKey === "string" && appetizePublicKey.length > 0 ? appetizePublicKey : undefined,
    };
  } catch {
    return null;
  }
}

export async function listProjectsFromFirestore(): Promise<{
  projects: ProjectDoc[];
  fromFirestore: boolean;
}> {
  const db = getDb();
  if (!db) return { projects: [], fromFirestore: false };
  try {
    const snap = await db.collection(COLLECTION).orderBy("updatedAt", "desc").get();
    const projects: ProjectDoc[] = snap.docs.map((d) => {
      const data = d.data();
      const appetizePublicKey = data.appetizePublicKey;
      return {
        id: (data.id as string) || d.id,
        name: (data.name as string) || "Untitled app",
        bundleId: (data.bundleId as string) || "",
        projectType: (data.projectType === "standard" ? "standard" : "pro") as "standard" | "pro",
        createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
        appetizePublicKey: typeof appetizePublicKey === "string" && appetizePublicKey.length > 0 ? appetizePublicKey : undefined,
      };
    });
    return { projects, fromFirestore: true };
  } catch {
    return { projects: [], fromFirestore: false };
  }
}

export async function createProjectInFirestore(doc: ProjectDoc): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const payload: Record<string, unknown> = {
      id: doc.id,
      name: doc.name,
      bundleId: doc.bundleId,
      projectType: doc.projectType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    if (doc.appetizePublicKey != null && doc.appetizePublicKey !== "") {
      payload.appetizePublicKey = doc.appetizePublicKey;
    }
    await db.collection(COLLECTION).doc(doc.id).set(payload);
    return true;
  } catch {
    return false;
  }
}

export async function updateProjectInFirestore(
  id: string,
  updates: Partial<Pick<ProjectDoc, "name" | "bundleId" | "projectType" | "appetizePublicKey">>
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    const updatedAt = Date.now();
    await ref.update({
      ...updates,
      updatedAt,
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteProjectFromFirestore(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.collection(COLLECTION).doc(id).delete();
    return true;
  } catch {
    return false;
  }
}
