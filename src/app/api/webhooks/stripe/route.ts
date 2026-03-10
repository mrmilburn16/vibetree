import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  setSubscriptionFromCheckout,
  setSubscriptionDeletedBySubscriptionId,
  getUserIdByStripeCustomerId,
  getUserIdBySubscriptionId,
  getSubscription,
  updateSubscriptionStatus,
  updateSubscriptionFromStripeSubscription,
} from "@/lib/subscriptionFirestore";
import type { SubscriptionStatus } from "@/lib/subscriptionFirestore";
import { getMonthlyCreditsForPlanId } from "@/lib/pricing";
import { setCreditBalance, addCredits } from "@/lib/userCreditsFirestore";

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
        if (session.mode === "payment") {
          const creditsRaw = session.metadata?.credits;
          const credits = typeof creditsRaw === "string" ? parseInt(creditsRaw, 10) : Number(creditsRaw);
          if (!Number.isFinite(credits) || credits <= 0) {
            console.warn("[webhooks/stripe] checkout.session.completed payment mode missing or invalid metadata.credits", creditsRaw);
            break;
          }
          const result = await addCredits(userId, credits);
          if (result.ok) {
            console.log("[webhooks/stripe] credits purchased", { userId, credits, balanceAfter: result.balanceAfter });
          } else {
            console.warn("[webhooks/stripe] credits purchase addCredits failed", { userId, credits, error: result.error });
          }
          break;
        }
        if (session.mode !== "subscription") {
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
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription & { current_period_end?: number };
        const status = subscription.status as "active" | "trialing" | "past_due" | "unpaid";
        const periodEndSeconds =
          subscription.current_period_end ??
          subscription.items?.data?.[0]?.current_period_end ??
          0;
        const currentPeriodEndMs = periodEndSeconds * 1000;
        await setSubscriptionFromCheckout(userId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planId,
          status,
          currentPeriodEnd: currentPeriodEndMs,
        });
        const initialCredits = getMonthlyCreditsForPlanId(planId);
        if (initialCredits > 0) {
          await setCreditBalance(userId, initialCredits);
        }
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
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) {
          console.warn("[webhooks/stripe] invoice.payment_failed missing customer");
          break;
        }
        const userId = await getUserIdByStripeCustomerId(customerId);
        if (!userId) {
          console.warn("[webhooks/stripe] invoice.payment_failed no user for customer", customerId);
          break;
        }
        await updateSubscriptionStatus(userId, "past_due");
        console.log("[webhooks/stripe] subscription set past_due", { userId });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;
        const userId = await getUserIdBySubscriptionId(subscriptionId);
        if (!userId) {
          console.warn(
            "[webhooks/stripe] customer.subscription.updated no user for subscription",
            subscriptionId
          );
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription & { current_period_end?: number };
        const status = (subscription.status ?? "active") as SubscriptionStatus;
        const periodEndSeconds =
          subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end ?? 0;
        const currentPeriodEndMs = periodEndSeconds * 1000;
        const planIdRaw = subscription.metadata?.planId as string | undefined;
        const validPlanId =
          planIdRaw === "starter" || planIdRaw === "builder" || planIdRaw === "pro"
            ? planIdRaw
            : undefined;
        await updateSubscriptionFromStripeSubscription(userId, {
          status,
          currentPeriodEnd: currentPeriodEndMs,
          planId: validPlanId,
        });
        console.log("[webhooks/stripe] subscription updated", {
          userId,
          status,
          planId: validPlanId ?? "(unchanged)",
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) {
          console.warn("[webhooks/stripe] invoice.paid missing customer");
          break;
        }
        const userId = await getUserIdByStripeCustomerId(customerId);
        if (!userId) {
          console.warn("[webhooks/stripe] invoice.paid no user for customer", customerId);
          break;
        }
        const sub = await getSubscription(userId);
        if (sub?.status === "past_due") {
          await updateSubscriptionStatus(userId, "active");
          console.log("[webhooks/stripe] subscription restored to active after retry", { userId });
        }
        if (invoice.billing_reason === "subscription_cycle") {
          const planId = sub?.planId ?? null;
          if (planId && (planId === "starter" || planId === "builder" || planId === "pro")) {
            const allowance = getMonthlyCreditsForPlanId(planId);
            if (allowance > 0) {
              await setCreditBalance(userId, allowance);
              console.log("[webhooks/stripe] credits reset on renewal", { userId, planId, allowance });
            }
          }
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
