import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCreditBalance, DEFAULT_CREDITS } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";

/** Owner/admin bypass: show this balance in UI so they never hit "out of credits". */
const OWNER_DISPLAY_BALANCE = 9999;

/**
 * GET /api/credits
 * Returns the credit balance for the current user (session required).
 * New users get DEFAULT_CREDITS (10) on first access.
 * Owner bypass: if user is in OWNER_USER_IDS env var, returns OWNER_DISPLAY_BALANCE so UI shows unlimited.
 */
export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = user.uid;
  if (typeof uid === "string" && uid.trim() && isProxyOwner(uid)) {
    return NextResponse.json({
      balance: OWNER_DISPLAY_BALANCE,
      monthlyAllowance: DEFAULT_CREDITS,
      resetDate: null,
    });
  }
  const balance = await getCreditBalance(uid);
  return NextResponse.json({
    balance,
    monthlyAllowance: DEFAULT_CREDITS,
    resetDate: null,
  });
}
