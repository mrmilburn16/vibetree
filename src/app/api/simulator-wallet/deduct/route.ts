import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deduct } from "@/lib/simulatorWalletFirestore";

/**
 * POST /api/simulator-wallet/deduct
 * Body: { amountCents: number }. Used during simulator session for real-time deduction.
 */
export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { amountCents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amountCents = typeof body.amountCents === "number" ? Math.round(body.amountCents) : 0;
  if (amountCents <= 0) {
    return NextResponse.json({ error: "amountCents must be positive" }, { status: 400 });
  }
  const result = await deduct(user.uid, amountCents);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Deduction failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    success: true,
    balanceCents: result.balanceCents,
    balanceDollars: (result.balanceCents / 100).toFixed(2),
  });
}
