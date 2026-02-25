/**
 * Persistent analytics log for LLM requests. Tracks per-request timing, token
 * usage, cost, and inter-message gaps so we can compute prompt caching ROI.
 *
 * Storage: append-only JSONL at data/llm-analytics.jsonl.
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const LOG_PATH = join(process.cwd(), "data", "llm-analytics.jsonl");

export interface LLMAnalyticsEntry {
  id: string;
  timestamp: string;
  projectId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  cacheHit: boolean;
  estimatedCostUsd: number;
  durationMs: number;
  /** Time in ms since the previous request for this project (null if first). */
  gapFromPrevMs: number | null;
  projectType: "standard" | "pro";
}

const lastRequestByProject = new Map<string, number>();

export function logLLMAnalytics(
  entry: Omit<LLMAnalyticsEntry, "id" | "timestamp" | "gapFromPrevMs" | "cacheHit">
): void {
  const now = Date.now();
  const prev = lastRequestByProject.get(entry.projectId) ?? null;
  const gapFromPrevMs = prev !== null ? now - prev : null;
  lastRequestByProject.set(entry.projectId, now);

  const record: LLMAnalyticsEntry = {
    id: `llm_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(now).toISOString(),
    gapFromPrevMs,
    cacheHit: (entry.cacheReadTokens ?? 0) > 0,
    ...entry,
  };

  try {
    const dir = dirname(LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(record) + "\n", "utf8");
  } catch (e) {
    console.error("[llm-analytics] Failed to write:", e);
  }
}

export function getAllLLMAnalytics(): LLMAnalyticsEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  try {
    return readFileSync(LOG_PATH, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LLMAnalyticsEntry);
  } catch {
    return [];
  }
}

export interface CachingROIStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgBuildDurationMs: number;
  avgGapBetweenMessagesMs: number | null;
  medianGapMs: number | null;
  /** % of follow-up messages that came within 5 min of the previous (would hit 5m cache). */
  pctWithin5min: number;
  /** % within 1 hour (would hit 1h cache). */
  pctWithin1hr: number;
  /** Estimated monthly cost with no caching. */
  projectedMonthlyCostNone: number;
  /** Estimated monthly cost with 5-minute cache TTL. */
  projectedMonthlyCost5min: number;
  /** Estimated monthly cost with 1-hour cache TTL. */
  projectedMonthlyCost1hr: number;
  /** How many unique projects sent requests. */
  uniqueProjects: number;
  /** Per-model breakdown. */
  byModel: Record<string, { requests: number; inputTokens: number; costUsd: number }>;
  /** Distribution buckets: [<1m, 1-5m, 5-15m, 15-60m, 1h+] */
  gapDistribution: number[];
  /** Requests in the last 24h, 7d, 30d. */
  recentCounts: { last24h: number; last7d: number; last30d: number };
  /** Actual cache hit rate (% of requests where cacheReadTokens > 0). */
  actualCacheHitRate: number;
  /** Total tokens served from cache. */
  totalCacheReadTokens: number;
  /** Total tokens written to cache. */
  totalCacheWriteTokens: number;
  /** Actual savings vs full input price ($ saved by cache reads). */
  actualSavingsUsd: number;
  /** Number of requests that had any cache activity. */
  requestsWithCache: number;
}

export function getCachingROIStats(): CachingROIStats {
  const entries = getAllLLMAnalytics();
  const n = entries.length;

  if (n === 0) {
    return {
      totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0,
      totalCostUsd: 0, avgBuildDurationMs: 0, avgGapBetweenMessagesMs: null,
      medianGapMs: null, pctWithin5min: 0, pctWithin1hr: 0,
      projectedMonthlyCostNone: 0, projectedMonthlyCost5min: 0,
      projectedMonthlyCost1hr: 0, uniqueProjects: 0, byModel: {},
      gapDistribution: [0, 0, 0, 0, 0], recentCounts: { last24h: 0, last7d: 0, last30d: 0 },
      actualCacheHitRate: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0,
      actualSavingsUsd: 0, requestsWithCache: 0,
    };
  }

  let totalInput = 0, totalOutput = 0, totalCost = 0, totalDuration = 0;
  let totalCacheRead = 0, totalCacheWrite = 0, cacheHitCount = 0, requestsWithCache = 0;
  const gaps: number[] = [];
  const projects = new Set<string>();
  const byModel: Record<string, { requests: number; inputTokens: number; costUsd: number }> = {};
  const gapBuckets = [0, 0, 0, 0, 0]; // <1m, 1-5m, 5-15m, 15-60m, 1h+

  const now = Date.now();
  let last24h = 0, last7d = 0, last30d = 0;

  for (const e of entries) {
    totalInput += e.inputTokens;
    totalOutput += e.outputTokens;
    totalCost += e.estimatedCostUsd;
    totalDuration += e.durationMs;
    projects.add(e.projectId);

    const eRead = e.cacheReadTokens ?? 0;
    const eWrite = e.cacheWriteTokens ?? 0;
    totalCacheRead += eRead;
    totalCacheWrite += eWrite;
    if (eRead > 0) cacheHitCount++;
    if (eRead > 0 || eWrite > 0) requestsWithCache++;

    if (!byModel[e.model]) byModel[e.model] = { requests: 0, inputTokens: 0, costUsd: 0 };
    byModel[e.model].requests++;
    byModel[e.model].inputTokens += e.inputTokens;
    byModel[e.model].costUsd += e.estimatedCostUsd;

    if (e.gapFromPrevMs !== null) {
      gaps.push(e.gapFromPrevMs);
      const mins = e.gapFromPrevMs / 60_000;
      if (mins < 1) gapBuckets[0]++;
      else if (mins < 5) gapBuckets[1]++;
      else if (mins < 15) gapBuckets[2]++;
      else if (mins < 60) gapBuckets[3]++;
      else gapBuckets[4]++;
    }

    const ts = new Date(e.timestamp).getTime();
    if (now - ts < 86_400_000) last24h++;
    if (now - ts < 7 * 86_400_000) last7d++;
    if (now - ts < 30 * 86_400_000) last30d++;
  }

  const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps.length > 0 ? sortedGaps[Math.floor(sortedGaps.length / 2)] : null;
  const within5min = gaps.filter((g) => g <= 5 * 60_000).length;
  const within1hr = gaps.filter((g) => g <= 60 * 60_000).length;
  const pct5 = gaps.length > 0 ? Math.round((within5min / gaps.length) * 100) : 0;
  const pct1h = gaps.length > 0 ? Math.round((within1hr / gaps.length) * 100) : 0;

  // Project monthly costs under each caching scenario.
  // System prompt is ~3500 tokens on average. We model input tokens as:
  //   systemTokens (cacheable) + messageTokens (not cacheable)
  const estSystemTokens = 3500;

  // No caching: all input tokens at full price (already captured in totalCost).
  // For projection, scale to 30d based on the data window.
  const dataSpanMs = entries.length >= 2
    ? new Date(entries[entries.length - 1].timestamp).getTime() - new Date(entries[0].timestamp).getTime()
    : 30 * 86_400_000;
  const scaleFactor = dataSpanMs > 0 ? (30 * 86_400_000) / dataSpanMs : 1;

  const projNone = totalCost * scaleFactor;

  // 5-min cache: cache hits pay 10% for system tokens; misses pay 125%.
  // A "hit" is when gap < 5 min.
  const hitRate5 = pct5 / 100;
  const inputCostFraction = totalInput > 0 ? (totalCost * (totalInput / (totalInput + totalOutput * 5))) : 0;
  const systemFrac = Math.min(estSystemTokens * n / Math.max(totalInput, 1), 1);
  const savingsRate5 = systemFrac * (hitRate5 * 0.9 - (1 - hitRate5) * 0.25);
  const proj5 = projNone * (1 - savingsRate5 * (inputCostFraction / Math.max(totalCost, 0.001)));

  // 1-hour cache: same logic but 1h hit rate and 2x write cost on miss.
  const hitRate1h = pct1h / 100;
  const savingsRate1h = systemFrac * (hitRate1h * 0.9 - (1 - hitRate1h) * 1.0);
  const proj1h = projNone * (1 - savingsRate1h * (inputCostFraction / Math.max(totalCost, 0.001)));

  // Cache reads saved 90% of what those tokens would have cost at full input price.
  // Use Sonnet pricing ($3/M input) as default since it's the most common model.
  const defaultInputPricePerM = 3;
  const actualSavingsUsd = (totalCacheRead / 1_000_000) * defaultInputPricePerM * 0.9;
  const actualCacheHitRate = n > 0 ? Math.round((cacheHitCount / n) * 100) : 0;

  return {
    totalRequests: n,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCostUsd: Math.round(totalCost * 1000) / 1000,
    avgBuildDurationMs: Math.round(totalDuration / n),
    avgGapBetweenMessagesMs: avgGap !== null ? Math.round(avgGap) : null,
    medianGapMs: medianGap !== null ? Math.round(medianGap) : null,
    pctWithin5min: pct5,
    pctWithin1hr: pct1h,
    projectedMonthlyCostNone: Math.round(projNone * 100) / 100,
    projectedMonthlyCost5min: Math.round((proj5 < 0 ? projNone : proj5) * 100) / 100,
    projectedMonthlyCost1hr: Math.round((proj1h < 0 ? projNone : proj1h) * 100) / 100,
    uniqueProjects: projects.size,
    byModel,
    gapDistribution: gapBuckets,
    recentCounts: { last24h, last7d, last30d },
    actualCacheHitRate,
    totalCacheReadTokens: totalCacheRead,
    totalCacheWriteTokens: totalCacheWrite,
    actualSavingsUsd: Math.round(actualSavingsUsd * 1000) / 1000,
    requestsWithCache,
  };
}
