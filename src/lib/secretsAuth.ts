import { getSession } from "@/lib/auth";

/**
 * Resolve the authenticated user id for secrets API requests.
 * A user must only access their own secrets.
 * Uses the same session as web (cookie or Bearer Firebase ID token).
 */
export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const user = await getSession(request);
  return user?.uid ?? null;
}
