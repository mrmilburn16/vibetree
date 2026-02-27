# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Vibetree is an AI-powered iOS app builder (Next.js 16 / TypeScript / Tailwind CSS v4). Users describe apps in plain language; AI generates Swift or Expo code. The product runs in **mock-first** mode by default — no external services needed.

### Running the app

- **Dev server (mock mode):** `npm run dev:mock` (port 3002) — fully functional without API keys
- **Dev server (default):** `npm run dev` (port 3001)
- See `package.json` scripts for all available commands.

### Key development notes

- **Project types:** "Pro (Swift)" requires Mac runner + iPhone + Team ID to enable chat; "Standard (Expo)" works immediately in mock mode. Use Standard (Expo) for testing chat/editor flows without macOS.
- **Lint:** `npm run lint` — the codebase has pre-existing lint errors (React hooks, `no-explicit-any`, etc.) that are part of the repo; do not attempt to fix them unless asked.
- **Tests:** `npm run test` (vitest) — all 165 tests should pass.
- **Build:** `npm run build` compiles the Next.js app. This is fine to run.
- **DO NOT use the Vibetree product to generate or build iOS apps.** Never type prompts into the editor chat (the "describe your app" input), never trigger in-app builds, and never hit Build in the Xcode flow within the web app. Running the dev server (`npm run dev` / `npm run dev:mock`) is allowed; using the product to create apps is not — unless the user explicitly grants permission.
- **Feature flags:** `NEXT_PUBLIC_USE_REAL_LLM=true` enables real Claude API (requires `ANTHROPIC_API_KEY`); `NEXT_PUBLIC_USE_REAL_MAC=true` enables real Mac fleet. Both default to `false` (mock).
- **Storage:** Falls back to in-memory store when Firebase is not configured — no database setup needed for development.
- **Environment vars:** See `.env.example` for all configuration options.
- **Stripe:** Checkout and webhook routes exist at `/api/checkout` and `/api/webhooks/stripe`. Returns 503 gracefully when `STRIPE_SECRET_KEY` is unset.
- **Contact form:** `/api/contact` sends via Resend when `RESEND_API_KEY` is set; logs to console otherwise.
- **Credits:** Server-side credit store at `/api/credits` (Firestore-backed with in-memory fallback). User identified by `x-user-email` header — will switch to Firebase Auth tokens.
- **Rate limiting:** Auth, contact, message, and waitlist endpoints are rate-limited (in-memory sliding window).
- **Sentry:** Error monitoring wired in via `@sentry/nextjs`. Activated when `NEXT_PUBLIC_SENTRY_DSN` is set.
- **Analytics:** Google Analytics or Plausible loaded when `NEXT_PUBLIC_GA_MEASUREMENT_ID` or `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.
