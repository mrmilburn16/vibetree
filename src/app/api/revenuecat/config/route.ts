import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRevenueCatConfig } from "@/lib/revenuecatFirestore";

/**
 * GET /api/revenuecat/config
 * Session-only auth. Returns the saved RevenueCat config for the current user (for build system to inject public API key).
 */
export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getRevenueCatConfig(user.uid);
  return NextResponse.json(config ?? null);
}
