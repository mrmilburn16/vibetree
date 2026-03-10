# Stripe subscription setup

## Env vars

Add to `.env.local`:

```bash
# Stripe (subscriptions)
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_... for test mode
STRIPE_WEBHOOK_SECRET=whsec_...        # from Stripe Dashboard → Webhooks → Add endpoint → Signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...   # or pk_test_... (used by client if you add Stripe.js later)

# Price IDs (create products first with script below)
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_BUILDER_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...

# Credit packs (one-time; from same script)
STRIPE_PRICE_CREDITS_50=price_...
STRIPE_PRICE_CREDITS_100=price_...
STRIPE_PRICE_CREDITS_250=price_...
STRIPE_PRICE_CREDITS_500=price_...
```

## Create products and prices

Run once (test or live key). Creates both subscription plans and credit pack one-time prices:

```bash
STRIPE_SECRET_KEY=sk_test_... node scripts/create-stripe-products.mjs
```

Copy the printed `STRIPE_PRICE_*` lines into `.env.local`.

## Webhook endpoint

In Stripe Dashboard → Webhooks → Add endpoint:

- **URL:** `https://your-domain.com/api/webhooks/stripe`
- **Events:** `checkout.session.completed`, `customer.subscription.deleted`
- Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

For local testing use Stripe CLI: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
