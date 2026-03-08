import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deductCredits, getCreditBalance } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";

/** Owner bypass: return this balance after "deduct" so UI never drops. */
const OWNER_DISPLAY_BALANCE = 9999;

/**
 * POST /api/credits/deduct
 * Body: { amount: number }. Deducts from the user's balance. Returns new balance.
 * Owner bypass: if user is in OWNER_USER_IDS or matches OWNER_USER_ID_HARDCODED, no deduction; returns OWNER_DISPLAY_BALANCE.
 */
export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = user.uid;
  if (typeof uid === "string" && uid.trim() && isProxyOwner(uid)) {
    return NextResponse.json({ balance: OWNER_DISPLAY_BALANCE });
  }
  let body: { amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amount = typeof body.amount === "number" ? Math.max(0, body.amount) : 0;
  if (amount === 0) {
    const balance = await getCreditBalance(uid);
    return NextResponse.json({ balance });
  }
  const result = await deductCredits(uid, amount);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Deduction failed" },
      { status: result.error === "Insufficient credits" ? 402 : 500 }
    );
  }
  return NextResponse.json({ balance: result.balanceAfter });
}
