/**
 * In-memory TTL cache for proxy responses. Single process only; no Redis.
 * Used by /api/proxy/weather, /api/proxy/plant-identify, /api/proxy/places.
 */

type CacheEntry = { value: unknown; expiresAt: number; setAt: number };

export type ProxyCacheOptions = {
  ttlSeconds: number;
  /** Max entries; when exceeded, oldest (by insertion order) is evicted. */
  maxSize?: number;
};

/** Lazy cleanup: remove expired entries when we encounter them. */
function sweepExpired(entries: Map<string, CacheEntry>, keysBySetOrder: string[]): void {
  const now = Date.now();
  for (const [key, entry] of entries.entries()) {
    if (entry.expiresAt <= now) {
      entries.delete(key);
      const i = keysBySetOrder.indexOf(key);
      if (i >= 0) keysBySetOrder.splice(i, 1);
    }
  }
}

/** Periodic sweep interval (5 minutes). */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
const cachesWithSweep: Array<{ entries: Map<string, CacheEntry>; keysBySetOrder: string[] }> = [];

function registerForSweep(entries: Map<string, CacheEntry>, keysBySetOrder: string[]): void {
  cachesWithSweep.push({ entries, keysBySetOrder });
  if (!sweepTimer) {
    sweepTimer = setInterval(() => {
      for (const { entries: e, keysBySetOrder: k } of cachesWithSweep) {
        sweepExpired(e, k);
      }
    }, SWEEP_INTERVAL_MS);
    if (sweepTimer.unref) sweepTimer.unref();
  }
}

export function createProxyCache(options: ProxyCacheOptions) {
  const { ttlSeconds, maxSize } = options;
  const entries = new Map<string, CacheEntry>();
  const keysBySetOrder: string[] = [];

  function get(key: string): unknown | null {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      entries.delete(key);
      const i = keysBySetOrder.indexOf(key);
      if (i >= 0) keysBySetOrder.splice(i, 1);
      return null;
    }
    return entry.value;
  }

  function set(key: string, value: unknown, ttlSec?: number): void {
    const now = Date.now();
    const ttl = ttlSec ?? ttlSeconds;
    const expiresAt = now + ttl * 1000;

    if (maxSize != null && entries.size >= maxSize && !entries.has(key)) {
      const oldest = keysBySetOrder.shift();
      if (oldest) entries.delete(oldest);
    }

    entries.set(key, { value, expiresAt, setAt: now });
    const i = keysBySetOrder.indexOf(key);
    if (i >= 0) keysBySetOrder.splice(i, 1);
    keysBySetOrder.push(key);
  }

  registerForSweep(entries, keysBySetOrder);
  return { get, set };
}

/** Simple djb2-style hash for cache keys (e.g. base64 image). Not crypto-secure. */
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
