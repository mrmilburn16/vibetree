/**
 * Stripe client and plan/price mapping for subscriptions.
 * Products and prices are created via scripts/create-stripe-products.mjs;
 * price IDs are set in env.
 */

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!secretKey) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey);
  }
  return stripeInstance;
}

/** Paid plan IDs that have a Stripe Price (monthly). */
export const STRIPE_PAID_PLANS = ["starter", "builder", "pro"] as const;
export type StripePlanId = (typeof STRIPE_PAID_PLANS)[number];

const PRICE_ID_ENV_KEYS: Record<StripePlanId, string> = {
  starter: "STRIPE_PRICE_STARTER_MONTHLY",
  builder: "STRIPE_PRICE_BUILDER_MONTHLY",
  pro: "STRIPE_PRICE_PRO_MONTHLY",
};

/**
 * Get the Stripe Price ID for a plan (monthly).
 * Returns null if plan is free or env is not set.
 */
export function getPriceIdForPlan(planId: string): string | null {
  if (!STRIPE_PAID_PLANS.includes(planId as StripePlanId)) return null;
  const key = PRICE_ID_ENV_KEYS[planId as StripePlanId];
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isPaidPlanId(planId: string): planId is StripePlanId {
  return STRIPE_PAID_PLANS.includes(planId as StripePlanId);
}
