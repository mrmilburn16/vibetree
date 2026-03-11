/**
 * Firestore persistence for per-user API enabled/disabled preferences.
 * Stored at users/{userId}.enabledApis: Record<string, boolean>
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "users";

export type ApiPreferences = Record<string, boolean>;

/** Defaults applied when the user has no stored preferences. Paid APIs default OFF. */
export const DEFAULT_API_PREFERENCES: ApiPreferences = {
  openweathermap: true,
  "plant-id": false,
  stripe: false,
  revenuecat: false,
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

export async function getApiPreferences(userId: string): Promise<ApiPreferences> {
  const db = getDb();
  if (!db) return { ...DEFAULT_API_PREFERENCES };
  try {
    const snap = await db.collection(COLLECTION).doc(userId).get();
    if (!snap.exists) return { ...DEFAULT_API_PREFERENCES };
    const stored = snap.data()?.enabledApis;
    if (!stored || typeof stored !== "object") return { ...DEFAULT_API_PREFERENCES };
    return { ...DEFAULT_API_PREFERENCES, ...stored };
  } catch {
    return { ...DEFAULT_API_PREFERENCES };
  }
}

export async function setApiPreference(
  userId: string,
  apiId: string,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };
  try {
    await db.collection(COLLECTION).doc(userId).set(
      { enabledApis: { [apiId]: enabled } },
      { merge: true }
    );
    return { ok: true };
  } catch (e) {
    console.error("[userApiPreferencesFirestore] setApiPreference failed:", e);
    return { ok: false, error: "Failed to save." };
  }
}
