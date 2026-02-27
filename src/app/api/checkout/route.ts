import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { CREDIT_PACKS } from "@/lib/credits";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for a credit pack purchase.
 * Body: { packId: string, userEmail?: string }
 *
 * Returns: { url: string } — the Checkout redirect URL.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`checkout:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Payments are not configured yet." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const packId = typeof body.packId === "string" ? body.packId : "";
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : undefined;

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `http://localhost:${process.env.PORT || 3001}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pack.priceUsd * 100,
            product_data: {
              name: pack.label,
              description: `${pack.credits} Vibetree credits`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        packId: pack.id,
        credits: String(pack.credits),
        userEmail: userEmail ?? "",
      },
      customer_email: userEmail || undefined,
      success_url: `${siteUrl}/credits?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/credits`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Stripe error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
