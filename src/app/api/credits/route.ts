import { NextResponse } from "next/server";

/**
 * GET /api/credits
 * Returns the credit balance. Currently returns a default since
 * the web app uses localStorage. The iOS app uses this endpoint
 * to sync balance. A proper server-side store would replace this.
 */
export async function GET() {
  return NextResponse.json({
    balance: 50,
    monthlyAllowance: 50,
    resetDate: null,
  });
}
