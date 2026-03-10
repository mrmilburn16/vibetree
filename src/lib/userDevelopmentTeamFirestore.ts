/**
 * Firestore persistence for user's Apple Developer Team ID (code signing).
 * Stored at users/{userId}.developmentTeamId.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "users";

/** Apple Team IDs are exactly 10 alphanumeric characters (uppercase). */
export const TEAM_ID_REGEX = /^[A-Z0-9]{10}$/;

export function isValidDevelopmentTeamId(value: string): boolean {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return TEAM_ID_REGEX.test(normalized);
}

export function normalizeDevelopmentTeamId(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

export async function getDevelopmentTeamId(userId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(userId).get();
    if (!snap.exists) return null;
    const value = snap.data()?.developmentTeamId;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export async function setDevelopmentTeamId(userId: string, teamId: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeDevelopmentTeamId(teamId);
  if (!TEAM_ID_REGEX.test(normalized)) {
    return { ok: false, error: "Team ID must be exactly 10 letters or numbers (e.g. from Apple Developer → Membership details)." };
  }
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };
  try {
    await db.collection(COLLECTION).doc(userId).set(
      { developmentTeamId: normalized, developmentTeamIdUpdatedAt: Date.now() },
      { merge: true }
    );
    return { ok: true };
  } catch (e) {
    console.error("[userDevelopmentTeamFirestore] setDevelopmentTeamId failed:", e);
    return { ok: false, error: "Failed to save." };
  }
}
