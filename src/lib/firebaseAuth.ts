import { getAuth } from "firebase-admin/auth";
import { getAdminDb } from "./firebaseAdmin";

/** Get Firebase Admin Auth (uses same app as Firestore). */
function getAdminAuth() {
  getAdminDb(); // ensures app is initialized
  return getAuth();
}

/**
 * Verify Firebase ID token from Authorization header.
 * Returns { uid, email } or null if invalid/missing.
 */
export async function verifyIdToken(
  authHeader: string | null
): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? undefined };
  } catch {
    return null;
  }
}
