/**
 * Firestore log for proxy API calls.
 * Collection: proxy_call_logs
 * Each document records one proxy call: endpoint, actual cost, user charge, margin.
 * Used by /admin/api-costs "Live Cost Log" section.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const PROXY_CALL_LOGS_COLLECTION = "proxy_call_logs";

export type ProxyCallLogEntry = {
  /** Firestore document ID (auto-generated). */
  id: string;
  /** ISO timestamp string for display. */
  timestamp: string;
  /** Proxy slug, e.g. "ai", "places", "weather". */
  endpoint: string;
  /** User ID who made the call (empty string if none). */
  userId: string;
  /** What we actually paid (USD). 0 for free-tier APIs. */
  actualCostUsd: number;
  /** What we charged the user (USD; credits converted at $0.10/credit). */
  chargedUsd: number;
  /** Credits deducted from user (0 if free). */
  chargedCredits: number;
  /** Margin percentage: (chargedUsd - actualCostUsd) / actualCostUsd * 100. null when actualCostUsd is 0. */
  marginPercent: number | null;
  /** Optional metadata (e.g. token counts for AI calls). */
  meta?: Record<string, unknown>;
};

type RawDoc = {
  timestamp: Timestamp;
  endpoint: string;
  userId: string;
  actualCostUsd: number;
  chargedUsd: number;
  chargedCredits: number;
  marginPercent: number | null;
  meta?: Record<string, unknown>;
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

function calcMargin(actualCostUsd: number, chargedUsd: number): number | null {
  if (actualCostUsd <= 0) return null;
  return Math.round(((chargedUsd - actualCostUsd) / actualCostUsd) * 100);
}

export interface LogProxyCallParams {
  endpoint: string;
  userId: string;
  actualCostUsd: number;
  chargedCredits: number;
  /** USD per credit. Default: 0.10 (10 credits = $1). */
  creditValueUsd?: number;
  meta?: Record<string, unknown>;
}

/**
 * Write a proxy call log entry to Firestore. Fire-and-forget safe: errors are caught.
 */
export async function logProxyCall(params: LogProxyCallParams): Promise<void> {
  const db = getDb();
  if (!db) return;

  const creditValueUsd = params.creditValueUsd ?? 0.1;
  const chargedUsd = params.chargedCredits * creditValueUsd;
  const marginPercent = calcMargin(params.actualCostUsd, chargedUsd);

  try {
    await db.collection(PROXY_CALL_LOGS_COLLECTION).add({
      timestamp: FieldValue.serverTimestamp(),
      endpoint: params.endpoint,
      userId: params.userId,
      actualCostUsd: params.actualCostUsd,
      chargedUsd,
      chargedCredits: params.chargedCredits,
      marginPercent,
      ...(params.meta ? { meta: params.meta } : {}),
    });
  } catch (err) {
    console.error("[proxyCallLog] Failed to write log entry", err);
  }
}

/**
 * Fetch the most recent proxy call log entries.
 * Returns entries sorted newest-first.
 */
export async function getRecentProxyCallLogs(
  limit = 50
): Promise<ProxyCallLogEntry[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const snap = await db
      .collection(PROXY_CALL_LOGS_COLLECTION)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data() as RawDoc;
      const ts: string =
        d.timestamp instanceof Timestamp
          ? d.timestamp.toDate().toISOString()
          : new Date().toISOString();
      return {
        id: doc.id,
        timestamp: ts,
        endpoint: d.endpoint ?? "unknown",
        userId: d.userId ?? "",
        actualCostUsd: typeof d.actualCostUsd === "number" ? d.actualCostUsd : 0,
        chargedUsd: typeof d.chargedUsd === "number" ? d.chargedUsd : 0,
        chargedCredits: typeof d.chargedCredits === "number" ? d.chargedCredits : 0,
        marginPercent: typeof d.marginPercent === "number" ? d.marginPercent : null,
        meta: d.meta,
      };
    });
  } catch (err) {
    console.error("[proxyCallLog] Failed to read log entries", err);
    return [];
  }
}
