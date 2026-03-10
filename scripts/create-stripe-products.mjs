#!/usr/bin/env node
/**
 * One-time setup: create Stripe Products and Prices for Starter, Builder, Pro (monthly)
 * and credit packs (one-time). Requires STRIPE_SECRET_KEY in env. Prints the price IDs to add to .env.local.
 *
 * Usage: STRIPE_SECRET_KEY=sk_... node scripts/create-stripe-products.mjs
 */

import Stripe from "stripe";

const PLANS = [
  { id: "starter", name: "Starter", priceCents: 2500 },
  { id: "builder", name: "Builder", priceCents: 5000 },
  { id: "pro", name: "Pro", priceCents: 10000 },
];

const CREDIT_PACKS = [
  { id: "50", credits: 50, priceCents: 5000 },
  { id: "100", credits: 100, priceCents: 10000 },
  { id: "250", credits: 250, priceCents: 25000 },
  { id: "500", credits: 500, priceCents: 50000 },
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY in env.");
    process.exit(1);
  }
  const stripe = new Stripe(key);

  console.log("Creating Stripe Products and Prices (monthly plans)...\n");

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

  console.log("\nCreating Stripe Products and Prices (credit packs, one-time)...\n");

  for (const pack of CREDIT_PACKS) {
    const product = await stripe.products.create({
      name: `Vibetree ${pack.credits} Credits`,
      description: `${pack.credits} credits — one-time purchase`,
      metadata: { packId: pack.id, credits: String(pack.credits) },
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: pack.priceCents,
      metadata: { packId: pack.id, credits: String(pack.credits) },
    });
    const envKey = `STRIPE_PRICE_CREDITS_${pack.id}`;
    console.log(`${envKey}=${price.id}`);
  }

  console.log("\nAdd the above lines to .env.local.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
