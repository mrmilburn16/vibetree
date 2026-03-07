/**
 * Owner bypass for proxy credit checks.
 * If the requesting user's ID is in OWNER_USER_IDS (comma-separated env) or matches
 * OWNER_USER_ID_HARDCODED, proxy endpoints may skip credit balance check and deduction.
 */

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

/** Returns true if this user ID should bypass proxy credit checks (no balance check, no deduction). */
export function isProxyOwner(userId: string): boolean {
  return getOwnerUserIds().has(userId);
}
