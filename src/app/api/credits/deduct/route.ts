import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deductCredits, getCreditBalance } from "@/lib/userCreditsFirestore";

/**
 * POST /api/credits/deduct
 * Body: { amount: number }. Deducts from the user's balance. Returns new balance.
 */
export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amount = typeof body.amount === "number" ? Math.max(0, body.amount) : 0;
  if (amount === 0) {
    const balance = await getCreditBalance(user.uid);
    return NextResponse.json({ balance });
  }
  const result = await deductCredits(user.uid, amount);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Deduction failed" },
      { status: result.error === "Insufficient credits" ? 402 : 500 }
    );
  }
  return NextResponse.json({ balance: result.balanceAfter });
}
