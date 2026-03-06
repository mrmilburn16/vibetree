import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSubscription, hasActiveSubscription } from "@/lib/subscriptionFirestore";

/**
 * GET /api/subscription
 * Returns the current user's subscription status. Used to gate Pro features in the UI.
 */
export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscription(user.uid);
  const active = await hasActiveSubscription(user.uid);

  return NextResponse.json({
    active,
    planId: sub?.planId ?? "free",
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  });
}
