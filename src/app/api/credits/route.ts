import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCreditBalance, DEFAULT_CREDITS } from "@/lib/userCreditsFirestore";

/**
 * GET /api/credits
 * Returns the credit balance for the current user (session required).
 * New users get DEFAULT_CREDITS (10) on first access.
 */
export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const balance = await getCreditBalance(user.uid);
  return NextResponse.json({
    balance,
    monthlyAllowance: DEFAULT_CREDITS,
    resetDate: null,
  });
}
