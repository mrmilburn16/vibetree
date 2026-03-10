import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

const CREDIT_PACK_IDS = ["50", "100", "250", "500"] as const;
const PACK_CREDITS: Record<string, number> = { "50": 50, "100": 100, "250": 250, "500": 500 };

function getPriceIdForCreditsPack(packId: string): string | null {
  if (!CREDIT_PACK_IDS.includes(packId as (typeof CREDIT_PACK_IDS)[number])) return null;
  const key = `STRIPE_PRICE_CREDITS_${packId}`;
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const packId = typeof body.packId === "string" ? body.packId.trim() : "";
  if (!packId || !CREDIT_PACK_IDS.includes(packId as (typeof CREDIT_PACK_IDS)[number])) {
    return NextResponse.json(
      { error: "Invalid packId. Use 50, 100, 250, or 500." },
      { status: 400 }
    );
  }

  const priceId = getPriceIdForCreditsPack(packId);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured for this pack. Add STRIPE_PRICE_CREDITS_* to env." },
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

  const credits = PACK_CREDITS[packId] ?? 0;
  const origin =
    request.headers.get("origin") ||
    request.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3001";
  const baseUrl = origin.replace(/\/$/, "");
  const successUrl = `${baseUrl}/credits?purchase=success`;
  const cancelUrl = `${baseUrl}/credits?purchase=cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      client_reference_id: user.uid,
      metadata: { userId: user.uid, credits: String(credits) },
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
    console.error("[stripe create-credits-checkout]", e);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
