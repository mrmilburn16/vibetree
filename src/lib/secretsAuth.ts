/**
 * Resolve the authenticated user id for secrets API requests.
 * A user must only access their own secrets.
 */

export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const auth =
    request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token) return null;

  // Stub: demo token from /api/auth/login is "demo_<base64(email:timestamp)>"
  if (token.startsWith("demo_")) {
    try {
      const payload = Buffer.from(token.slice(5), "base64").toString("utf8");
      const email = payload.split(":")[0];
      if (email && email.length > 0) return email;
    } catch {
      return null;
    }
  }

  // TODO: verify JWT and return sub/userId when real auth is in place
  return null;
}
