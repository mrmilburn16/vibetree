import { NextRequest, NextResponse } from "next/server";
import { getCredits, deductCredits, addCredits } from "@/lib/creditsStore";

/**
 * Resolve the current user identifier.
 *
 * Right now this reads `x-user-email` header (set by the client from the
 * localStorage session) or falls back to a cookie. When Firebase Auth is
 * added, replace this with token verification.
 */
function getUserId(req: NextRequest): string | null {
  return (
    req.headers.get("x-user-email") ||
    req.cookies.get("vibetree-uid")?.value ||
    null
  );
}

/**
 * GET /api/credits — return current balance.
 */
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { balance: 50, monthlyAllowance: 50, resetDate: null },
      { status: 200 }
    );
  }

  const rec = await getCredits(userId);
  return NextResponse.json({
    balance: rec.balance,
    monthlyAllowance: rec.includedPerPeriod,
    resetDate: rec.periodStart,
  });
}

/**
 * POST /api/credits — deduct or add credits.
 *
 * Body: { action: "deduct" | "add", amount: number }
 */
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action;
  const amount = typeof body.amount === "number" ? body.amount : NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
  }

  if (action === "deduct") {
    const result = await deductCredits(userId, amount);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Insufficient credits.", balance: result.balance },
        { status: 402 }
      );
    }
    return NextResponse.json({ ok: true, balance: result.balance });
  }

  if (action === "add") {
    const result = await addCredits(userId, amount);
    return NextResponse.json({ ok: true, balance: result.balance });
  }

  return NextResponse.json({ error: "Invalid action. Use 'deduct' or 'add'." }, { status: 400 });
}
