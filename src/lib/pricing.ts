/**
 * Vibetree pricing: plan definitions.
 */

export type BillingInterval = "monthly" | "annual";

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  /** Prompts per month (displayed in plan). */
  promptsPerMonth: number;
  /** Optional overage note (e.g. Pro: $1.00 per additional prompt). */
  overageNote?: string;
  features: PlanFeature[];
  cta: string;
  /** Use ghost/outline style for CTA button (e.g. Free plan). */
  ctaVariant?: "primary" | "secondary" | "ghost";
  highlighted?: boolean;
  /** Show italic add-on note under simulator feature (paid plans). */
  simulatorAddOnNote?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Build your first app for free.",
    monthlyPrice: 0,
    promptsPerMonth: 5,
    cta: "Get started free",
    ctaVariant: "ghost",
    simulatorAddOnNote: false,
    features: [
      { text: "5 prompts/month", included: true },
      { text: "Sonnet and Auto models only", included: true },
      { text: "2 app limit", included: true },
      { text: "Test your app on your computer", included: true },
      { text: "Project settings", included: true },
      { text: "Run on device", included: false },
      { text: "Code export", included: false },
      { text: "Publish to App Store", included: false },
      { text: "Premium models (Opus, GPT)", included: false },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description: "Start building real iOS apps.",
    monthlyPrice: 25,
    promptsPerMonth: 25,
    cta: "Get started",
    ctaVariant: "primary",
    simulatorAddOnNote: true,
    features: [
      { text: "25 prompts/month", included: true },
      { text: "All models (Sonnet, Opus, GPT, Auto)", included: true },
      { text: "10 app limit", included: true },
      { text: "Run on device via desktop agent", included: true },
      { text: "Test your app on your computer", included: true },
      { text: "Code export", included: true },
      { text: "Project settings and app icon", included: true },
      { text: "Publish to App Store", included: true },
      { text: "Email support", included: true },
    ],
  },
  {
    id: "builder",
    name: "Builder",
    description: "For serious app builders.",
    monthlyPrice: 50,
    promptsPerMonth: 50,
    cta: "Start building",
    ctaVariant: "primary",
    highlighted: true,
    simulatorAddOnNote: true,
    features: [
      { text: "50 prompts/month", included: true },
      { text: "All models", included: true },
      { text: "25 app limit", included: true },
      { text: "Everything in Starter", included: true },
      { text: "Priority builds", included: true },
      { text: "Test your app on your computer", included: true },
      { text: "Code export, project settings, app icon", included: true },
      { text: "Publish to App Store", included: true },
      { text: "Email support", included: true },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For power users and high volume.",
    monthlyPrice: 100,
    promptsPerMonth: 100,
    overageNote: "Overages at $1.00 per additional prompt",
    cta: "Go Pro",
    ctaVariant: "primary",
    simulatorAddOnNote: true,
    features: [
      { text: "100 prompts/month", included: true },
      { text: "All models", included: true },
      { text: "Unlimited apps", included: true },
      { text: "Everything in Builder", included: true },
      { text: "Priority support", included: true },
      { text: "Test your app on your computer", included: true },
      { text: "Run on device, code export, publish", included: true },
    ],
  },
];

export const DEFAULT_PLAN_ID = "free";

/** Monthly credit allowance for a plan (used for subscription grant and renewal reset). */
export function getMonthlyCreditsForPlanId(planId: string): number {
  const plan = PLANS.find((p) => p.id === planId);
  return plan ? plan.promptsPerMonth : 0;
}

/** Legacy: credit usage (for reference; plans are now prompt-based). */
export const CREDIT_USAGE = {
  MESSAGE_STANDARD: 1,
  MESSAGE_PREMIUM: 3,
  BUILD: 5,
  RUN_ON_DEVICE: 10,
  PUBLISH: 25,
} as const;
