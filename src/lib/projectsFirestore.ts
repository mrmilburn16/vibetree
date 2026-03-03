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
  /** Owner's Firebase Auth uid. Required for user-scoped access. */
  userId: string;
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

/** Fetch a single project by id. If userId is provided, only return if doc.userId matches. */
export async function getProjectFromFirestore(id: string, userId?: string): Promise<ProjectDoc | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    const docUserId = (data.userId as string) ?? "";
    if (userId != null && docUserId !== userId) return null;
    const appetizePublicKey = data.appetizePublicKey;
    return {
      id: (data.id as string) || snap.id,
      name: (data.name as string) || "Untitled app",
      bundleId: (data.bundleId as string) || "",
      projectType: (data.projectType === "standard" ? "standard" : "pro") as "standard" | "pro",
      createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
      userId: docUserId,
      appetizePublicKey: typeof appetizePublicKey === "string" && appetizePublicKey.length > 0 ? appetizePublicKey : undefined,
    };
  } catch {
    return null;
  }
}

export async function listProjectsFromFirestore(userId: string): Promise<{
  projects: ProjectDoc[];
  fromFirestore: boolean;
}> {
  const db = getDb();
  if (!db) return { projects: [], fromFirestore: false };
  try {
    const snap = await db
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .orderBy("updatedAt", "desc")
      .get();
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
        userId: (data.userId as string) ?? "",
        appetizePublicKey: typeof appetizePublicKey === "string" && appetizePublicKey.length > 0 ? appetizePublicKey : undefined,
      };
    });
    return { projects, fromFirestore: true };
  } catch (err) {
    console.error("[projects-firestore] listProjectsFromFirestore failed:", err);
    const e = err as { code?: string; message?: string };
    if (e?.message) console.error("[projects-firestore] message:", e.message);
    if (e?.code) console.error("[projects-firestore] code:", e.code);
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
      userId: doc.userId,
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
  updates: Partial<Pick<ProjectDoc, "name" | "bundleId" | "projectType" | "appetizePublicKey">>,
  userId?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    if (userId != null && (snap.data()?.userId as string) !== userId) return false;
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

export async function deleteProjectFromFirestore(id: string, userId?: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const ref = db.collection(COLLECTION).doc(id);
    if (userId != null) {
      const snap = await ref.get();
      if (!snap.exists || (snap.data()?.userId as string) !== userId) return false;
    }
    await ref.delete();
    return true;
  } catch {
    return false;
  }
}
