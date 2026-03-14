/**
 * Shared free-tier check for proxy endpoints.
 *
 * Each proxy that has a dailyFreeLimit calls checkAndConsumeFreeTier() before
 * deciding whether to deduct credits. If the user is within their daily free
 * allowance the call is free and the Firestore counter is incremented. Once the
 * allowance is exhausted the call falls through to normal credit deduction.
 *
 * Storage: api_usage/{userId}/daily/{YYYY-MM-DD}  field = apiId (FieldValue.increment)
 * Resets: daily (new document path = new day, UTC midnight).
 */

import {
  getDailyUsage,
  incrementDailyUsage,
  getTodayDateKey,
} from "@/lib/apiUsageFirestore";
import { getProxyDailyFreeLimit } from "@/lib/proxyBillingRate";

export type FreeTierCheck = {
  isFree: boolean;
  /** How many free calls the user has used today after this call (only meaningful when isFree=true). */
  usedToday: number;
  /** The configured limit, or null if none. */
  limitToday: number | null;
};

/**
 * Check whether this call falls within the user's daily free allowance and, if
 * so, increment the Firestore counter.
 *
 * @param userId    - The VibeTree user ID. Must be a non-empty string.
 * @param proxySlug - The marketplace proxySlug, e.g. "ai", "email".
 * @param apiId     - The Firestore field name for this API (marketplace entry id),
 *                    e.g. "anthropic-claude", "resend-email". Used as the counter
 *                    field inside the daily Firestore document.
 * @param ownerBypass - If true, always returns isFree=true without touching Firestore.
 */
export async function checkAndConsumeFreeTier(
  userId: string,
  proxySlug: string,
  apiId: string,
  ownerBypass: boolean
): Promise<FreeTierCheck> {
  // Owner always gets a free pass — never consumes the free tier counter.
  if (ownerBypass) {
    return { isFree: true, usedToday: 0, limitToday: null };
  }

  const limitToday = await getProxyDailyFreeLimit(proxySlug);

  // No free tier configured for this endpoint.
  if (limitToday === null) {
    return { isFree: false, usedToday: 0, limitToday: null };
  }

  const dateKey = getTodayDateKey();
  const usedBefore = await getDailyUsage(userId, dateKey, apiId);

  if (usedBefore < limitToday) {
    // Within the free allowance — increment and mark free.
    await incrementDailyUsage(userId, dateKey, apiId);
    return { isFree: true, usedToday: usedBefore + 1, limitToday };
  }

  // Free allowance exhausted — caller should deduct credits.
  return { isFree: false, usedToday: usedBefore, limitToday };
}
