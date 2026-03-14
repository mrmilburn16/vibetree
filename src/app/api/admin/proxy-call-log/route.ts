/**
 * GET /api/admin/proxy-call-log
 * Returns the 50 most recent proxy call log entries plus aggregate totals.
 * Admin-only (requires admin session).
 * Response: { entries: ProxyCallLogEntry[], totals: { totalActualCostUsd, totalChargedUsd, overallMarginPercent } }
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { getRecentProxyCallLogs } from "@/lib/proxyCallLog";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getRecentProxyCallLogs(50);

  const totalActualCostUsd = entries.reduce((sum, e) => sum + e.actualCostUsd, 0);
  const totalChargedUsd = entries.reduce((sum, e) => sum + e.chargedUsd, 0);
  const overallMarginPercent =
    totalActualCostUsd > 0
      ? Math.round(((totalChargedUsd - totalActualCostUsd) / totalActualCostUsd) * 100)
      : null;

  return NextResponse.json({
    entries,
    totals: {
      totalActualCostUsd,
      totalChargedUsd,
      overallMarginPercent,
      entryCount: entries.length,
    },
  });
}
