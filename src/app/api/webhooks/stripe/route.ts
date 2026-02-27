import { NextRequest, NextResponse } from "next/server";
import { requireStripe } from "@/lib/stripe";
import { addCredits } from "@/lib/creditsStore";

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events. Currently processes:
 * - checkout.session.completed → credits the user's account
 *
 * Stripe signs every webhook payload with STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event;
  try {
    const stripe = requireStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const credits = parseInt(session.metadata?.credits ?? "0", 10);
    const userEmail = session.metadata?.userEmail ?? session.customer_email ?? "";

    if (credits > 0 && userEmail) {
      const result = await addCredits(userEmail, credits);
      console.log(
        `[stripe-webhook] Credited ${credits} credits to ${userEmail}. New balance: ${result.balance}`
      );
    } else {
      console.warn("[stripe-webhook] checkout.session.completed with missing credits or email:", session.id);
    }
  }

  return NextResponse.json({ received: true });
}
