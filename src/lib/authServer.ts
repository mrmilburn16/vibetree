/**
 * Server-side auth: verify Firebase ID token from request.
 * Returns userId when valid, null otherwise.
 */

import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function getAuthUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid ?? null;
  } catch {
    return null;
  }
}

/** Check if Firestore/Firebase Admin is configured (for project persistence). */
export function isFirestoreConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}
