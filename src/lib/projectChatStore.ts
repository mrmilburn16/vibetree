/**
 * Project chat persistence via Firestore (collection: project_chats).
 * Document ID: projectId.replace(/[^a-zA-Z0-9_-]/g, "") (same as legacy filename stem).
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "project_chats";

export type PersistedChat = {
  projectId: string;
  updatedAt: number;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    editedFiles?: string[];
    usage?: { input_tokens: number; output_tokens: number };
    estimatedCostUsd?: number;
  }>;
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

function docId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_-]/g, "");
}

function fromFirestoreData(id: string, data: Record<string, unknown>): PersistedChat {
  const messages = (Array.isArray(data.messages) ? data.messages : []) as PersistedChat["messages"];
  return {
    projectId: (data.projectId as string) ?? id,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
    messages,
  };
}

export async function getProjectChat(projectId: string): Promise<PersistedChat | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const id = docId(projectId);
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return fromFirestoreData(id, doc.data()!);
  } catch {
    return null;
  }
}

export async function setProjectChat(
  projectId: string,
  messages: PersistedChat["messages"]
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const id = docId(projectId);
    const payload: Omit<PersistedChat, "projectId"> & { projectId: string } = {
      projectId,
      updatedAt: Date.now(),
      messages,
    };
    await db.collection(COLLECTION).doc(id).set(payload);
  } catch (e) {
    console.error("[project-chat] Firestore write failed:", e);
  }
}
