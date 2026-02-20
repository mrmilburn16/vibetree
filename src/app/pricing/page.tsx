"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui";
import {
  PLANS,
  CREDIT_USAGE,
  type Plan,
  type BillingInterval,
} from "@/lib/pricing";

function CreditTable() {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-default)] bg-[var(--background-tertiary)]">
            <th className="px-4 py-3 font-medium text-[var(--text-primary)]">Action</th>
            <th className="px-4 py-3 font-medium text-[var(--text-primary)]">Credits</th>
          </tr>
        </thead>
        <tbody className="text-[var(--text-secondary)]">
          <tr className="border-b border-[var(--border-default)]">
            <td className="px-4 py-3">1 AI message (standard model)</td>
            <td className="px-4 py-3">{CREDIT_USAGE.MESSAGE_STANDARD}</td>
          </tr>
          <tr className="border-b border-[var(--border-default)]">
            <td className="px-4 py-3">1 AI message (premium model)</td>
            <td className="px-4 py-3">{CREDIT_USAGE.MESSAGE_PREMIUM}</td>
          </tr>
          <tr className="border-b border-[var(--border-default)]">
            <td className="px-4 py-3">1 build (simulator preview)</td>
            <td className="px-4 py-3">{CREDIT_USAGE.BUILD}</td>
          </tr>
          <tr className="border-b border-[var(--border-default)]">
            <td className="px-4 py-3">1 Run on device</td>
            <td className="px-4 py-3">{CREDIT_USAGE.RUN_ON_DEVICE}</td>
          </tr>
          <tr>
            <td className="px-4 py-3">1 App Store publish</td>
            <td className="px-4 py-3">{CREDIT_USAGE.PUBLISH}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlanCard({
  plan,
  interval,
}: {
  plan: Plan;
  interval: BillingInterval;
}) {
  const price =
    interval === "annual" && plan.annualPrice !== null
      ? plan.annualPrice
      : plan.monthlyPrice;
  const isAnnual = interval === "annual";
  const showAnnualEquivalent =
    isAnnual &&
    plan.annualMonthlyEquivalent !== null &&
    plan.annualMonthlyEquivalent > 0;

  return (
    <Card
      className={`relative flex h-full flex-col ${
        plan.highlighted
          ? "ring-2 ring-[var(--button-primary-bg)] border-[var(--button-primary-bg)]"
          : ""
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--button-primary-bg)] px-3 py-0.5 text-xs font-medium text-white">
          Most popular
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-heading-card">{plan.name}</h3>
        <p className="text-body-muted mt-1 text-sm">{plan.description}</p>
      </div>
      <div className="mb-6">
        {price === 0 ? (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-[var(--text-primary)]">$0</span>
            <span className="text-[var(--text-tertiary)]">/month</span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[var(--text-primary)]">
                ${isAnnual && plan.annualMonthlyEquivalent != null ? plan.annualMonthlyEquivalent.toFixed(0) : price}
              </span>
              <span className="text-[var(--text-tertiary)]">/month</span>
            </div>
            {isAnnual && plan.annualPrice != null && plan.annualPrice > 0 && (
              <p className="text-caption mt-1">
                Billed ${plan.annualPrice}/year (save 2 months)
              </p>
            )}
          </>
        )}
        {plan.creditsPerMonth !== null && (
          <p className="text-caption mt-1">
            {plan.creditsPerMonth.toLocaleString()} credits/month
          </p>
        )}
      </div>
      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((f, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 text-sm ${
              f.included ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]"
            }`}
          >
            {f.included ? (
              <span className="text-[var(--semantic-success)]" aria-hidden>✓</span>
            ) : (
              <span className="text-[var(--text-tertiary)]" aria-hidden>—</span>
            )}
            {f.text}
          </li>
        ))}
      </ul>
      <div>
        {plan.hasFreeTrial && (
          <p className="text-caption mb-2 text-[var(--semantic-success)]">
            {plan.freeTrialDays}-day free trial • No card required
          </p>
        )}
        <Link
          href={plan.id === "creator" ? "/dashboard" : "/dashboard"}
          className="block"
        >
          <Button
            variant={plan.highlighted ? "primary" : "secondary"}
            className="w-full"
          >
            {plan.cta}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <Nav />
      <main>
        {/* Hero */}
        <section className="border-b border-[var(--border-default)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-heading-hero mb-4">Simple pricing</h1>
            <p className="text-body-muted text-lg">
              One credit system for AI and builds. Start free, upgrade when you’re ready to ship.
            </p>
          </div>
        </section>

        {/* Credit system */}
        <section className="border-b border-[var(--border-default)] px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-heading-section mb-2">How credits work</h2>
            <p className="text-body-muted mb-6">
              Credits power AI chat and builds. Each plan includes a monthly allowance; usage resets every billing period.
            </p>
            <CreditTable />
          </div>
        </section>

        {/* How we set pricing (3 strategists) */}
        <section className="border-b border-[var(--border-default)] px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-heading-section mb-6">How we set pricing</h2>
            <p className="text-body-muted mb-8 max-w-2xl">
              We asked three pricing strategists with decades of experience to review Vibetree’s features and recommend plans and prices. Here’s the synthesis.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              <Card>
                <h3 className="text-heading-card mb-2">Value-based</h3>
                <p className="text-body-muted text-sm">
                  Price by outcome: learn (Free), ship (Pro), scale (Team). Pro at $25–35/mo with publish and Run on device; Team $70–90/mo with seats. Annual ~17% off.
                </p>
              </Card>
              <Card>
                <h3 className="text-heading-card mb-2">Usage-based</h3>
                <p className="text-body-muted text-sm">
                  Transparent credits: 50 (Free), 500 (Pro), 2,000 (Team). Clear credit-per-dollar so users know what they pay for. Pro $29/mo, Team $79/mo.
                </p>
              </Card>
              <Card>
                <h3 className="text-heading-card mb-2">Competitive</h3>
                <p className="text-body-muted text-sm">
                  Land with a generous free tier, convert with a 14-day Pro trial (no card). Match no-code and dev-tool expectations: $29/mo and $79/mo with annual discount.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Billing toggle + plans */}
        <section className="px-4 py-12 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 flex flex-col items-center gap-4">
              <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-1">
                <button
                  type="button"
                  onClick={() => setInterval("monthly")}
                  className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium transition-colors ${
                    interval === "monthly"
                      ? "bg-[var(--button-primary-bg)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setInterval("annual")}
                  className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium transition-colors ${
                    interval === "annual"
                      ? "bg-[var(--button-primary-bg)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Annual
                </button>
              </div>
              <p className="text-caption text-[var(--semantic-success)]">
                Save 2 months when you pay annually
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {PLANS.map((plan) => (
                <PlanCard key={plan.id} plan={plan} interval={interval} />
              ))}
            </div>

            <p className="text-caption mt-10 text-center text-[var(--text-tertiary)]">
              All prices in USD. Free trial applies to Pro and Team; no credit card required.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
