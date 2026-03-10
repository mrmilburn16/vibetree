import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscriptionFirestore";

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." },
      { status: 503 }
    );
  }

  const sub = await getSubscription(user.uid);
  const customerId = sub?.stripeCustomerId ?? null;
  if (!customerId) {
    return NextResponse.json(
      { error: "No subscription found. Subscribe at /pricing to manage billing." },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ||
    request.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3001";
  const baseUrl = origin.replace(/\/$/, "");
  const returnUrl = `${baseUrl}/dashboard`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a portal URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe create-portal-session]", e);
    return NextResponse.json(
      { error: "Failed to create billing portal session." },
      { status: 500 }
    );
  }
}
