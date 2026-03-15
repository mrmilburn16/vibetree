/**
 * Shared authentication utilities for all API proxy endpoints.
 *
 * Replaces the copy-pasted `normalizeToken` / `isAppTokenValid` functions that
 * previously lived independently in ai, email, images, plant-identify, and weather.
 *
 * Key functions:
 *   isAppTokenValid()   — validates X-App-Token header against VIBETREE_APP_TOKEN env var.
 *   getVerifiedUserId() — returns a Firebase-verified UID (session cookie or Bearer token), or null.
 *   resolveProxyAuth()  — combines both; call once at the top of each proxy handler.
 *
 * Billing rule:
 *   Credit deduction must ONLY use auth.verifiedUserId — never a userId from the request body
 *   or query string. A body/query userId may be used for free-tier tracking when an app token
 *   is present but no session exists, but it must never be trusted for billing.
 */

import { getSession } from "@/lib/auth";

export function normalizeToken(s: string | undefined): string {
  return (s ?? "").replace(/\r\n?|\n/g, "").trim();
}

/**
 * Returns true if the X-App-Token header matches the VIBETREE_APP_TOKEN env var.
 * Single source of truth — import this instead of copy-pasting.
 */
export function isAppTokenValid(request: Request): boolean {
  const appToken =
    process.env.VIBETREE_APP_TOKEN && normalizeToken(process.env.VIBETREE_APP_TOKEN);
  const headerToken = normalizeToken(
    request.headers.get("x-app-token") ?? request.headers.get("X-App-Token") ?? ""
  );
  return Boolean(appToken && headerToken && headerToken === appToken);
}

/**
 * Returns the Firebase-verified UID for the calling user, or null.
 * Checks in order: Authorization Bearer header → vibetree-session cookie.
 *
 * This is the only userId that should be used for billing/credit deduction.
 * Never fall back to a request-body or query-string userId for credits.
 */
export async function getVerifiedUserId(request: Request): Promise<string | null> {
  const user = await getSession(request);
  return user?.uid ?? null;
}

export interface ProxyAuthResult {
  /**
   * Firebase-verified UID from session cookie or Bearer token.
   * null when the request has no valid session (app-token-only or anonymous).
   * Only use this for billing/credit deduction.
   */
  verifiedUserId: string | null;
  /** True when the X-App-Token header matches VIBETREE_APP_TOKEN. */
  isAppToken: boolean;
  /**
   * True when the request carries either a valid session or a valid app token.
   * Return 401 to the caller if this is false.
   */
  isAuthorized: boolean;
}

/**
 * Resolves both session auth and app-token auth in a single async call.
 *
 * Usage pattern in proxy handlers:
 *
 *   const auth = await resolveProxyAuth(request);
 *   if (!auth.isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   // Free-tier tracking: prefer verified UID, fall back to a body/query userId.
 *   const trackingUserId = auth.verifiedUserId ?? bodyUserId;
 *
 *   // Credit deduction: require a verified session.
 *   if (needsCredits && !auth.verifiedUserId) {
 *     return NextResponse.json({ error: "Session required for credit billing" }, { status: 401 });
 *   }
 */
export async function resolveProxyAuth(request: Request): Promise<ProxyAuthResult> {
  const verifiedUserId = await getVerifiedUserId(request);
  const isAppToken = isAppTokenValid(request);
  const isAuthorized = verifiedUserId !== null || isAppToken;
  return { verifiedUserId, isAppToken, isAuthorized };
}
