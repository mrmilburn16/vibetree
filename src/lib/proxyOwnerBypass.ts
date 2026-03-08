/**
 * Owner bypass for credit checks (proxy and app generation).
 * If the user's ID is in OWNER_USER_IDS (comma-separated env) or matches
 * OWNER_USER_ID_HARDCODED, they get unlimited credits:
 * - Proxy (/api/proxy/ai): skip balance check and deduction.
 * - App generation (GET /api/credits, POST /api/credits/deduct): return high balance, no deduction.
 *
 * Comparison: we check getOwnerUserIds().has(userId) where userId must be the
 * Firebase Auth uid from the session (e.g. user.uid from getSession(request)).
 * OWNER_USER_ID_HARDCODED is a single Firebase uid string; OWNER_USER_IDS can add more.
 * We only return true when userId is a non-empty string and exactly matches one entry.
 */

/** Single hardcoded Firebase Auth uid that gets owner bypass. Compare against session user.uid only. */
const OWNER_USER_ID_HARDCODED = "1eYArCMnOxeEsiFbS0nehKjWbuI2";

let cachedOwnerIds: Set<string> | null = null;

function getOwnerUserIds(): Set<string> {
  if (cachedOwnerIds) return cachedOwnerIds;
  const ids = new Set<string>([OWNER_USER_ID_HARDCODED]);
  const env = process.env.OWNER_USER_IDS;
  if (typeof env === "string" && env.trim()) {
    env.split(",").forEach((id) => {
      const t = id.trim();
      if (t) ids.add(t);
    });
  }
  cachedOwnerIds = ids;
  return ids;
}

/**
 * Returns true only if userId is a non-empty string and exactly equals one of the owner ids.
 * Pass the Firebase Auth uid from the session (e.g. user.uid from getSession).
 * Returns false for undefined, null, "", or the literal string "undefined" so non-owners never match.
 */
export function isProxyOwner(userId: string): boolean {
  if (typeof userId !== "string" || !userId.trim()) return false;
  return getOwnerUserIds().has(userId);
}
