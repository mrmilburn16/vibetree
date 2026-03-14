/**
 * Live billing-rate lookup for proxy endpoints.
 *
 * Each proxy route calls getProxyCreditsPerCall(proxySlug) to find out how many
 * credits to deduct for the current call.  The value comes from the same
 * Firestore-backed marketplace registry that the admin /api-costs page edits, so
 * price changes propagate to every proxy within CACHE_TTL_MS (60 s) without a
 * redeploy.
 *
 * We cache the merged registry in module-level memory for 60 seconds to avoid
 * a Firestore read on every single proxy request.  In serverless environments
 * each warm instance has its own cache; stale instances will refresh within the
 * TTL window.
 */

import { mergeWithOverrides } from "@/lib/apiMarketplace";
import { getAllMarketplaceOverrides } from "@/lib/apiMarketplaceFirestore";

/** How long to keep the merged registry cached before re-reading Firestore. */
const CACHE_TTL_MS = 60_000; // 60 seconds

/** 10 credits = $1 USD.  Must match CREDITS_PER_DOLLAR in src/lib/credits.ts. */
const CREDITS_PER_DOLLAR = 10;

type CachedRegistry = ReturnType<typeof mergeWithOverrides>;

let _cached: CachedRegistry | null = null;
let _expiresAt = 0;
// Track in-flight fetch so concurrent callers share one Firestore read.
let _inflight: Promise<CachedRegistry> | null = null;

async function getMergedRegistry(): Promise<CachedRegistry> {
  const now = Date.now();
  if (_cached && now < _expiresAt) return _cached;

  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const overrides = await getAllMarketplaceOverrides();
      const merged = mergeWithOverrides(overrides);
      _cached = merged;
      _expiresAt = Date.now() + CACHE_TTL_MS;
      return merged;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

/**
 * Return the number of credits that should be deducted for one call to the
 * given proxy endpoint.
 *
 * - Returns 0 for free APIs or if the slug is not found in the registry.
 * - The value is derived from the live Firestore-backed userPricePerCallUsd
 *   converted to credits (10 credits = $1).
 */
export async function getProxyCreditsPerCall(proxySlug: string): Promise<number> {
  try {
    const registry = await getMergedRegistry();
    const entry = registry.find((e) => e.proxySlug === proxySlug);
    if (!entry) return 0;
    const usd = entry.userPricePerCallUsd;
    if (usd === null || usd <= 0) return 0;
    // Round to avoid floating-point drift (e.g. 0.12 * 10 = 1.2000000000000002)
    return Math.round(usd * CREDITS_PER_DOLLAR * 1e6) / 1e6;
  } catch (err) {
    console.error("[proxyBillingRate] Failed to read registry, falling back to 0:", err);
    return 0;
  }
}

/**
 * Return the userPricePerCallUsd for a proxy slug directly (for logging).
 * Returns null if free or not found.
 */
export async function getProxyUsdPerCall(proxySlug: string): Promise<number | null> {
  try {
    const registry = await getMergedRegistry();
    const entry = registry.find((e) => e.proxySlug === proxySlug);
    if (!entry) return null;
    return entry.userPricePerCallUsd;
  } catch {
    return null;
  }
}

/**
 * Return the daily free call limit for a proxy slug, or null if none is configured.
 * Reads from the same cached merged registry as getProxyCreditsPerCall.
 */
export async function getProxyDailyFreeLimit(proxySlug: string): Promise<number | null> {
  try {
    const registry = await getMergedRegistry();
    const entry = registry.find((e) => e.proxySlug === proxySlug);
    if (!entry) return null;
    const limit = entry.dailyFreeLimit;
    if (limit === undefined || limit === null || limit <= 0) return null;
    return limit;
  } catch (err) {
    console.error("[proxyBillingRate] Failed to read daily free limit, falling back to null:", err);
    return null;
  }
}

/** Force-expire the cache (useful after an admin price update). */
export function invalidateProxyBillingCache(): void {
  _cached = null;
  _expiresAt = 0;
  _inflight = null;
}
