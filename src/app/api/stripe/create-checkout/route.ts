import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStripe, getPriceIdForPlan, isPaidPlanId } from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId || !isPaidPlanId(planId)) {
    return NextResponse.json(
      { error: "Invalid planId. Use starter, builder, or pro." },
      { status: 400 }
    );
  }

  const priceId = getPriceIdForPlan(planId);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured for this plan. Add STRIPE_PRICE_*_MONTHLY to env." },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." },
      { status: 503 }
    );
  }

  const origin =
    request.headers.get("origin") ||
    request.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3001";
  const baseUrl = origin.replace(/\/$/, "");
  const successUrl = `${baseUrl}/dashboard?checkout=success`;
  const cancelUrl = `${baseUrl}/pricing?checkout=cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email ?? undefined,
      client_reference_id: user.uid,
      metadata: { userId: user.uid, planId },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe create-checkout]", e);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
