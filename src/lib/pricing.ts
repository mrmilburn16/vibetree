/**
 * Vibetree pricing: credit system and plan definitions.
 * Informed by three pricing-strategy perspectives (see PRICING.md).
 */

/** What consumes credits (for display and future billing). */
export const CREDIT_USAGE = {
  /** Per AI chat message — standard model (e.g. Haiku). */
  MESSAGE_STANDARD: 1,
  /** Per AI chat message — premium model (e.g. Opus, GPT-4o). */
  MESSAGE_PREMIUM: 3,
  /** Per build (simulator preview / live). */
  BUILD: 5,
  /** Per “Run on device” install (TestFlight or desktop agent). */
  RUN_ON_DEVICE: 10,
  /** Per App Store publish submission. */
  PUBLISH: 25,
} as const;

export type BillingInterval = "monthly" | "annual";

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  annualMonthlyEquivalent: number | null;
  creditsPerMonth: number | null;
  features: PlanFeature[];
  /** Which plan is used for free trial (Pro). */
  hasFreeTrial: boolean;
  freeTrialDays: number;
  cta: string;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "creator",
    name: "Creator",
    description: "Learn and prototype with one app.",
    monthlyPrice: 0,
    annualPrice: 0,
    annualMonthlyEquivalent: 0,
    creditsPerMonth: 50,
    hasFreeTrial: false,
    freeTrialDays: 0,
    cta: "Get started free",
    features: [
      { text: "1 app", included: true },
      { text: "50 credits/month", included: true },
      { text: "AI chat (Claude 3.5 Haiku)", included: true },
      { text: "Live simulator preview", included: true },
      { text: "Project settings (name, bundle ID)", included: true },
      { text: "Run on device", included: false },
      { text: "Publish to App Store", included: false },
      { text: "Premium AI models (Opus, GPT-4o)", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Ship real apps with premium AI and one-click publish.",
    monthlyPrice: 29,
    annualPrice: 290,
    annualMonthlyEquivalent: 24.17,
    creditsPerMonth: 500,
    hasFreeTrial: true,
    freeTrialDays: 14,
    cta: "Start 14-day free trial",
    highlighted: true,
    features: [
      { text: "5 apps", included: true },
      { text: "500 credits/month", included: true },
      { text: "All AI models (Opus, GPT-4o, Sonnet, Haiku)", included: true },
      { text: "Run on device (TestFlight + desktop agent)", included: true },
      { text: "Publish to App Store", included: true },
      { text: "Live simulator preview", included: true },
      { text: "Project settings & app icon", included: true },
      { text: "Email support", included: true },
    ],
  },
  {
    id: "team",
    name: "Team",
    description: "Unlimited apps and credits for growing teams.",
    monthlyPrice: 79,
    annualPrice: 790,
    annualMonthlyEquivalent: 65.83,
    creditsPerMonth: 2000,
    hasFreeTrial: true,
    freeTrialDays: 14,
    cta: "Start 14-day free trial",
    features: [
      { text: "Unlimited apps", included: true },
      { text: "2,000 credits/month", included: true },
      { text: "Everything in Pro", included: true },
      { text: "5 team seats (coming soon)", included: true },
      { text: "Priority support", included: true },
      { text: "SSO (coming soon)", included: true },
    ],
  },
];

export const DEFAULT_PLAN_ID = "creator";
