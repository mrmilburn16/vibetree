/**
 * Build feedback persistence via Firestore (collection: build_feedback).
 * Document ID: bf_${Date.now()}_${random}.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "build_feedback";

export type FeedbackEntry = {
  timestamp: string;
  projectId: string;
  rating: "up" | "down";
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

function generateId(): string {
  return `bf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function logBuildFeedback(entry: FeedbackEntry): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const id = generateId();
    await db.collection(COLLECTION).doc(id).set({
      timestamp: entry.timestamp,
      projectId: entry.projectId ?? "",
      rating: entry.rating,
    });
  } catch (e) {
    console.error("[build-feedback] Firestore write failed:", e);
  }
}

export async function getBuildFeedbackEntries(): Promise<FeedbackEntry[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(COLLECTION).orderBy("timestamp", "asc").get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        timestamp: (data.timestamp as string) ?? new Date().toISOString(),
        projectId: (data.projectId as string) ?? "",
        rating: data.rating === "up" || data.rating === "down" ? data.rating : "up",
      };
    });
  } catch {
    return [];
  }
}
