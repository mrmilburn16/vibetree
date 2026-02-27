/**
 * Integration token store for pre-wired integrations (X, Google, etc.).
 * Uses Firestore when configured, in-memory fallback for local dev.
 */

export type IntegrationProvider = "x" | "google" | "google-calendar" | "instagram" | "slack" | "linkedin" | "drive";

export interface IntegrationTokenRecord {
  projectId: string;
  userId?: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  meta?: Record<string, unknown>;
  updatedAt: number;
}

const COLLECTION = "integration_tokens";

function getDb() {
  try {
    const { getAdminDb } = require("@/lib/firebaseAdmin");
    return getAdminDb();
  } catch {
    return null;
  }
}

// In-memory fallback when Firestore is not configured
const memoryStore = new Map<string, IntegrationTokenRecord>();

function docId(projectId: string, userId: string | undefined, provider: IntegrationProvider): string {
  return `${projectId}:${userId ?? "default"}:${provider}`;
}

export async function getIntegrationToken(
  projectId: string,
  provider: IntegrationProvider,
  userId?: string
): Promise<IntegrationTokenRecord | null> {
  const db = getDb();
  const id = docId(projectId, userId, provider);

  if (db) {
    try {
      const doc = await db.collection(COLLECTION).doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data() as Record<string, unknown>;
      return {
        projectId: data.projectId as string,
        userId: data.userId as string | undefined,
        provider: data.provider as IntegrationProvider,
        accessToken: data.accessToken as string,
        refreshToken: data.refreshToken as string | undefined,
        expiresAt: data.expiresAt as number | undefined,
        meta: data.meta as Record<string, unknown> | undefined,
        updatedAt: (data.updatedAt as number) ?? Date.now(),
      };
    } catch {
      return null;
    }
  }

  return memoryStore.get(id) ?? null;
}

export async function setIntegrationToken(record: IntegrationTokenRecord): Promise<void> {
  const id = docId(record.projectId, record.userId, record.provider);
  const data = {
    ...record,
    updatedAt: Date.now(),
  };

  const db = getDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(id).set(data, { merge: true });
      return;
    } catch (e) {
      console.error("[integrationTokens] Firestore write failed, using memory:", e);
    }
  }

  memoryStore.set(id, { ...record, updatedAt: data.updatedAt });
}

export async function deleteIntegrationToken(
  projectId: string,
  provider: IntegrationProvider,
  userId?: string
): Promise<boolean> {
  const id = docId(projectId, userId, provider);
  const db = getDb();

  if (db) {
    try {
      await db.collection(COLLECTION).doc(id).delete();
      memoryStore.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  return memoryStore.delete(id);
}
