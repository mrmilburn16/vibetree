import { NextResponse } from "next/server";

/**
 * GET /api/publish/community-average
 * Returns the current community average time (in days) from App Store submit to live.
 * Mock: returns a placeholder. Replace with real computation from stored submission → Ready for Sale timestamps.
 */
export async function GET() {
  // Mock: in production, compute rolling average from submissions table (submit time → Ready for Sale time)
  const averageDays = 2;
  const sampleSize = 0; // 0 means "no data yet", frontend can show fallback message

  return NextResponse.json({
    averageDays,
    sampleSize,
    // Optional: averageHours for sub-day display
  });
}
