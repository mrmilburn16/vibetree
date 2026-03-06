#!/usr/bin/env node
/**
 * One-time setup: create Stripe Products and Prices for Starter, Builder, Pro (monthly).
 * Requires STRIPE_SECRET_KEY in env. Prints the price IDs to add to .env.local.
 *
 * Usage: STRIPE_SECRET_KEY=sk_... node scripts/create-stripe-products.mjs
 */

import Stripe from "stripe";

const PLANS = [
  { id: "starter", name: "Starter", priceCents: 2500 },
  { id: "builder", name: "Builder", priceCents: 5000 },
  { id: "pro", name: "Pro", priceCents: 10000 },
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY in env.");
    process.exit(1);
  }
  const stripe = new Stripe(key);

  console.log("Creating Stripe Products and Prices (monthly)...\n");

  for (const plan of PLANS) {
    const product = await stripe.products.create({
      name: `Vibetree ${plan.name}`,
      description: `Vibetree ${plan.name} plan — monthly subscription`,
      metadata: { planId: plan.id },
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: plan.priceCents,
      recurring: { interval: "month" },
      metadata: { planId: plan.id },
    });
    const envKey = `STRIPE_PRICE_${plan.id.toUpperCase()}_MONTHLY`;
    console.log(`${envKey}=${price.id}`);
  }

  console.log("\nAdd the above lines to .env.local.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
