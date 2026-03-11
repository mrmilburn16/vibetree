/**
 * Firestore persistence for per-user daily API usage (free API rate limiting).
 * Path: api_usage/{userId}/daily/{date} with fields { [apiId]: number }.
 * Date format: YYYY-MM-DD (UTC). Resets naturally each day via new document path.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "api_usage";
const SUBCOLLECTION = "daily";

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

/** Date key for today in UTC (YYYY-MM-DD). */
export function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Get current day's usage count for a user and API. */
export async function getDailyUsage(
  userId: string,
  dateKey: string,
  apiId: string
): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const ref = db.collection(COLLECTION).doc(userId).collection(SUBCOLLECTION).doc(dateKey);
    const snap = await ref.get();
    if (!snap.exists) return 0;
    const val = snap.data()?.[apiId];
    return typeof val === "number" && Number.isInteger(val) && val >= 0 ? val : 0;
  } catch {
    return 0;
  }
}

/** Increment daily usage by 1 for a user and API. Returns after increment. */
export async function incrementDailyUsage(
  userId: string,
  dateKey: string,
  apiId: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const ref = db.collection(COLLECTION).doc(userId).collection(SUBCOLLECTION).doc(dateKey);
  await ref.set({ [apiId]: FieldValue.increment(1) }, { merge: true });
}
