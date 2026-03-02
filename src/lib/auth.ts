import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export const SESSION_COOKIE_NAME = "vibetree-session";
/** Max age for session cookie (1 hour). Firebase ID tokens expire in 1 hour; client can refresh. */
export const SESSION_MAX_AGE = 60 * 60;

export interface SessionUser {
  uid: string;
  email: string | null;
}

/**
 * Get the current session from cookie or Authorization header.
 * Verifies the Firebase ID token and returns the decoded user or null.
 */
export async function getSession(request?: Request): Promise<SessionUser | null> {
  let token: string | undefined;

  if (request) {
    const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
    const m = authHeader?.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) token = m[1].trim();
  }

  if (!token) {
    const c = await cookies();
    token = c.get(SESSION_COOKIE_NAME)?.value;
  }

  if (!token) return null;

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Require auth; returns session user or throws/returns 401 response.
 * Use in API routes: const user = await requireAuth(request); if (!user) return 401 response.
 */
export async function requireAuth(request: Request): Promise<SessionUser | null> {
  const user = await getSession(request);
  return user;
}
