/**
 * Firestore-backed project store. Used when user is authenticated.
 * Projects are scoped by userId.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

export interface ProjectRecord {
  id: string;
  name: string;
  bundleId: string;
  createdAt: number;
  updatedAt: number;
}

const COLLECTION = "projects";

function makeDefaultBundleId(id: string): string {
  const raw = id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = raw && /^[a-z]/.test(raw) ? raw : `app${raw || "project"}`;
  return `com.vibetree.${suffix}`.slice(0, 60);
}

export async function listProjectsFirestore(userId: string): Promise<ProjectRecord[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .orderBy("updatedAt", "desc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id as string,
      name: (data.name as string) ?? "Untitled app",
      bundleId: (data.bundleId as string) ?? makeDefaultBundleId(data.id as string),
      createdAt: (data.createdAt?.toMillis?.() as number) ?? Date.now(),
      updatedAt: (data.updatedAt?.toMillis?.() as number) ?? Date.now(),
    };
  });
}

export async function getProjectFirestore(
  userId: string,
  projectId: string
): Promise<ProjectRecord | null> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .where("id", "==", projectId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const data = snap.docs[0]!.data();
  return {
    id: data.id as string,
    name: (data.name as string) ?? "Untitled app",
    bundleId: (data.bundleId as string) ?? makeDefaultBundleId(data.id as string),
    createdAt: (data.createdAt?.toMillis?.() as number) ?? Date.now(),
    updatedAt: (data.updatedAt?.toMillis?.() as number) ?? Date.now(),
  };
}

export async function createProjectFirestore(
  userId: string,
  name: string,
  id?: string
): Promise<ProjectRecord> {
  const db = getAdminDb();
  const projectId = id ?? `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const record: ProjectRecord = {
    id: projectId,
    name: name || "Untitled app",
    bundleId: makeDefaultBundleId(projectId),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).add({
    userId,
    ...record,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
  return record;
}

export async function ensureProjectFirestore(
  userId: string,
  projectId: string,
  name: string
): Promise<ProjectRecord> {
  const existing = await getProjectFirestore(userId, projectId);
  if (existing) return existing;
  return createProjectFirestore(userId, name, projectId);
}

export async function updateProjectFirestore(
  userId: string,
  projectId: string,
  updates: Partial<Pick<ProjectRecord, "name" | "bundleId">>
): Promise<ProjectRecord | null> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .where("id", "==", projectId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const ref = snap.docs[0]!.ref;
  const now = Date.now();
  const updateData: Record<string, unknown> = { updatedAt: new Date(now) };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.bundleId !== undefined) updateData.bundleId = updates.bundleId;
  await ref.update(updateData);
  const updated = await getProjectFirestore(userId, projectId);
  return updated;
}

export async function deleteProjectFirestore(
  userId: string,
  projectId: string
): Promise<boolean> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .where("id", "==", projectId)
    .limit(1)
    .get();
  if (snap.empty) return false;
  await snap.docs[0]!.ref.delete();
  return true;
}
