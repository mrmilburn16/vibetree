/**
 * Stripe client singleton.
 *
 * Initialised lazily so the app boots fine when STRIPE_SECRET_KEY is unset.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, { apiVersion: "2025-04-30.basil" });
  return _stripe;
}

export function requireStripe(): Stripe {
  const s = getStripe();
  if (!s) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return s;
}
