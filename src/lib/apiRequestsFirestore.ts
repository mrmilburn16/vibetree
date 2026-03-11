/**
 * Firestore persistence for API requests (users requesting APIs not yet listed).
 * Collection: api_requests. Fields: userId, email, apiName, requestedAt, status.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "api_requests";

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

export async function addApiRequest(
  userId: string,
  email: string | null,
  apiName: string
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };
  try {
    await db.collection(COLLECTION).add({
      userId,
      email: email ?? "",
      apiName: apiName.trim(),
      requestedAt: FieldValue.serverTimestamp(),
      status: "pending",
    });
    return { ok: true };
  } catch (e) {
    console.error("[apiRequestsFirestore] addApiRequest failed:", e);
    return { ok: false, error: "Failed to save request." };
  }
}
