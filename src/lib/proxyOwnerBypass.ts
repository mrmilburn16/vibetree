/**
 * Owner bypass for credit checks (proxy and app generation).
 * Reads owner user IDs from OWNER_USER_IDS env var (comma-separated Firebase Auth UIDs).
 * Users on this list skip all credit checks and free-tier counters.
 *
 * Configuration: set OWNER_USER_IDS=uid1,uid2 in your environment.
 * No UIDs are hardcoded — all owner IDs live in the environment.
 *
 * IMPORTANT: isProxyOwner() must only be called with a Firebase-verified UID from
 * resolveProxyAuth() / getVerifiedUserId(). Never pass a userId from the request body
 * or query string — that would allow any caller to claim owner status.
 */

let cachedOwnerIds: Set<string> | null = null;

function getOwnerUserIds(): Set<string> {
  if (cachedOwnerIds) return cachedOwnerIds;
  const ids = new Set<string>();
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
 * Returns true only if userId exactly matches one of the owner IDs from OWNER_USER_IDS env.
 * Always returns false for empty, null, or untrimmed input.
 */
export function isProxyOwner(userId: string): boolean {
  if (typeof userId !== "string" || !userId.trim()) return false;
  return getOwnerUserIds().has(userId);
}
