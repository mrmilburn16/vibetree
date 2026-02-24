/**
 * In-memory sliding-window rate limiter for API routes.
 * Each key (typically an IP or user ID) gets a window of allowed requests.
 * Resets automatically as time passes.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Check and consume a rate limit token for the given key.
 * Returns whether the request is allowed and how many remain.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  cleanup(config.windowMs);

  const cutoff = now - config.windowMs;
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldest + config.windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: config.windowMs,
  };
}

/**
 * Extract a rate-limit key from a request (IP-based).
 */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Pre-configured limits for different route categories. */
export const RATE_LIMITS = {
  /** General API endpoints: 60 req/min */
  standard: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,
  /** LLM/AI endpoints: 10 req/min (expensive) */
  llm: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,
  /** Auth endpoints: 10 req/min (brute force protection) */
  auth: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,
  /** Admin endpoints: 30 req/min */
  admin: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,
} as const;

/**
 * Helper: apply rate limiting to a request. Returns a 429 Response if limited, or null if allowed.
 */
export function applyRateLimit(
  request: Request,
  config: RateLimitConfig
): Response | null {
  const key = getRateLimitKey(request);
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        retryAfterMs: result.resetMs,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(result.resetMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}
