/**
 * In-memory 1-hour TTL build cache for the admin test suite.
 * Avoids re-running Claude + Xcode for the same prompt within an hour.
 * Uses globalThis so the store survives Next.js hot-reloads.
 */

import { hashString } from "@/lib/proxyCache";

export { hashString };

export type CachedBuildResult = {
  projectId: string;
  projectName: string;
  prompt: string;
  tier: string;
  category: string;
  compiled: boolean;
  attempts: number;
  autoFixUsed: boolean;
  compilerErrors: string[];
  fileCount: number;
  fileNames: string[];
  durationMs: number;
  skillsUsed: string[];
  generationCostUsd?: number | null;
};

export type CachedBuild = {
  promptHash: string;
  result: CachedBuildResult;
  /** Swift source files keyed by path, stored so a cached project can be restored. */
  projectFiles: Record<string, string>;
  cachedAt: number;
};

const TTL_MS = 60 * 60 * 1000; // 1 hour
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

const g = globalThis as unknown as {
  __buildCache?: Map<string, CachedBuild>;
  __buildCacheSweep?: ReturnType<typeof setInterval>;
};

if (!g.__buildCache) g.__buildCache = new Map();
const cache = g.__buildCache;

if (!g.__buildCacheSweep) {
  g.__buildCacheSweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.cachedAt > TTL_MS) {
        cache.delete(key);
      }
    }
  }, SWEEP_INTERVAL_MS);
  if (g.__buildCacheSweep.unref) g.__buildCacheSweep.unref();
}

export function getBuildCache(promptHash: string): CachedBuild | null {
  const entry = cache.get(promptHash);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(promptHash);
    console.log(`[BuildCache] EXPIRED: ${promptHash}`);
    return null;
  }
  return entry;
}

export function setBuildCache(
  promptHash: string,
  result: CachedBuildResult,
  projectFiles: Record<string, string>,
): void {
  cache.set(promptHash, { promptHash, result, projectFiles, cachedAt: Date.now() });
}

export function clearBuildCache(): void {
  cache.clear();
}

export function getBuildCacheSize(): number {
  return cache.size;
}

export function getBuildCacheEntries(): Array<{ promptHash: string; cachedAt: number; prompt: string }> {
  return Array.from(cache.values()).map(({ promptHash, cachedAt, result }) => ({
    promptHash,
    cachedAt,
    prompt: result.prompt.slice(0, 100),
  }));
}
