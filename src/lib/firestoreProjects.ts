import { getAdminDb } from "./firebaseAdmin";
import type { Project } from "./projects";

const PROJECTS_COLLECTION = "projects";

function projectsRef(uid: string) {
  return getAdminDb().collection("users").doc(uid).collection(PROJECTS_COLLECTION);
}

export async function getFirestoreProjects(uid: string): Promise<Project[]> {
  const snap = await projectsRef(uid).orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? "Untitled app",
      bundleId: data.bundleId ?? `com.vibetree.${d.id}`,
      createdAt: data.createdAt ?? 0,
      updatedAt: data.updatedAt ?? 0,
    };
  });
}

export async function createFirestoreProject(
  uid: string,
  projectId: string,
  name: string,
  bundleId: string
): Promise<Project> {
  const now = Date.now();
  await projectsRef(uid).doc(projectId).set({
    name,
    bundleId,
    createdAt: now,
    updatedAt: now,
  });
  return { id: projectId, name, bundleId, createdAt: now, updatedAt: now };
}

export async function getFirestoreProject(
  uid: string,
  projectId: string
): Promise<Project | null> {
  const doc = await projectsRef(uid).doc(projectId).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name ?? "Untitled app",
    bundleId: data.bundleId ?? `com.vibetree.${doc.id}`,
    createdAt: data.createdAt ?? 0,
    updatedAt: data.updatedAt ?? 0,
  };
}

export async function updateFirestoreProject(
  uid: string,
  projectId: string,
  updates: Partial<Pick<Project, "name" | "bundleId">>
): Promise<void> {
  await projectsRef(uid).doc(projectId).update({
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteFirestoreProject(
  uid: string,
  projectId: string
): Promise<void> {
  const batch = getAdminDb().batch();
  const projectRef = projectsRef(uid).doc(projectId);
  const filesRef = projectRef.collection("files");
  const chatRef = projectRef.collection("chat").doc("messages");

  const filesSnap = await filesRef.get();
  filesSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(chatRef);
  batch.delete(projectRef);
  await batch.commit();
}

export async function getFirestoreProjectFiles(
  uid: string,
  projectId: string
): Promise<Array<{ path: string; content: string }>> {
  const doc = await projectsRef(uid).doc(projectId).collection("files").doc("source").get();
  if (!doc.exists) return [];
  const data = doc.data();
  const files = data?.files ?? {};
  return Object.entries(files).map(([path, content]) => ({
    path,
    content: typeof content === "string" ? content : "",
  }));
}

export async function setFirestoreProjectFiles(
  uid: string,
  projectId: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  const obj: Record<string, string> = {};
  for (const { path, content } of files) {
    if (path && typeof content === "string") obj[path] = content;
  }
  await projectsRef(uid).doc(projectId).collection("files").doc("source").set(
    { files: obj, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function getFirestoreChat(
  uid: string,
  projectId: string
): Promise<Array<{ id: string; role: string; content: string; editedFiles?: string[]; usage?: unknown; estimatedCostUsd?: number }>> {
  const doc = await projectsRef(uid).doc(projectId).collection("chat").doc("messages").get();
  if (!doc.exists) return [];
  const data = doc.data();
  const messages = data?.messages ?? [];
  return Array.isArray(messages) ? messages : [];
}

export async function setFirestoreChat(
  uid: string,
  projectId: string,
  messages: Array<{ id: string; role: string; content: string; editedFiles?: string[]; usage?: unknown; estimatedCostUsd?: number }>
): Promise<void> {
  await projectsRef(uid).doc(projectId).collection("chat").doc("messages").set({
    messages,
    updatedAt: Date.now(),
  });
}
