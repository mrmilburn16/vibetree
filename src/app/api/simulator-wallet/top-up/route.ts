import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { topUp } from "@/lib/simulatorWalletFirestore";

/** Allowed top-up amounts in dollars. */
const ALLOWED_DOLLARS = [5, 10, 25] as const;

/**
 * POST /api/simulator-wallet/top-up
 * Body: { amount: 5 | 10 | 25 } (dollars). Mock success; updates Firestore.
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
  const amountDollars = typeof body.amount === "number" ? body.amount : 0;
  if (!ALLOWED_DOLLARS.includes(amountDollars as 5 | 10 | 25)) {
    return NextResponse.json(
      { error: "Amount must be 5, 10, or 25" },
      { status: 400 }
    );
  }
  const amountCents = amountDollars * 100;
  const result = await topUp(user.uid, amountCents);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Top-up failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    success: true,
    balanceCents: result.balanceCents,
    balanceDollars: (result.balanceCents / 100).toFixed(2),
  });
}
