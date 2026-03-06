import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  setSubscriptionFromCheckout,
  setSubscriptionDeletedBySubscriptionId,
} from "@/lib/subscriptionFirestore";

/** Stripe webhooks require the raw body for signature verification. Do not parse JSON before this. */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error("[webhooks/stripe] Stripe or STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[webhooks/stripe] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          (session.client_reference_id as string) ||
          (session.metadata?.userId as string);
        if (!userId) {
          console.warn("[webhooks/stripe] checkout.session.completed missing userId");
          break;
        }
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;
        const planId = (session.metadata?.planId as string) || null;
        if (!subscriptionId || !customerId || !planId) {
          console.warn(
            "[webhooks/stripe] checkout.session.completed missing subscription/customer/planId",
            { subscriptionId, customerId, planId }
          );
          break;
        }
        if (planId !== "starter" && planId !== "builder" && planId !== "pro") {
          console.warn("[webhooks/stripe] unknown planId", planId);
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const status = subscription.status as "active" | "trialing" | "past_due" | "unpaid";
        const currentPeriodEnd =
          subscription.items?.data?.[0]?.current_period_end ??
          (subscription as unknown as { current_period_end?: number }).current_period_end ??
          0;
        await setSubscriptionFromCheckout(userId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planId,
          status,
          currentPeriodEnd,
        });
        console.log("[webhooks/stripe] subscription active", { userId, planId });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;
        const ok = await setSubscriptionDeletedBySubscriptionId(subscriptionId);
        if (ok) {
          console.log("[webhooks/stripe] subscription deleted", { subscriptionId });
        } else {
          console.warn(
            "[webhooks/stripe] customer.subscription.deleted no user found for subscription",
            subscriptionId
          );
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[webhooks/stripe] handler error", event.type, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
