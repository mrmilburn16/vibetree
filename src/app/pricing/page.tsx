"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { PLANS, CREDIT_USAGE, type Plan, type PlanFeature } from "@/lib/pricing";

/** Simulator add-on note shown under the simulator feature on paid plans. */
const SIMULATOR_ADDON_NOTE = "Simulator available as add-on — $0.20/min, pay as you go";
/** Subtitle under "Test your app on your computer" on paid plans. */
const SIMULATOR_SUBTITLE = "See your full UI and UX in your browser. Haptic feedback and some hardware features not supported.";

function SimulatorExplanationModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulator preview"
      footer={
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
        Test your app directly in your browser without needing your iPhone. Tap through screens, validate your UI and UX, and see how your app feels — all on your computer. Note: haptic feedback and some hardware features aren&apos;t supported. Billed at $0.20/min from a prepaid wallet balance. You load funds upfront — no surprise charges, no unpaid bills. When your balance runs out, the session ends automatically.
      </p>
    </Modal>
  );
}

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
  onOpenSimulatorExplanation,
}: {
  plan: Plan;
  onOpenSimulatorExplanation: () => void;
}) {
  const variant = plan.ctaVariant ?? "primary";
  const isSimulatorFeature = (f: PlanFeature) =>
    f.text.toLowerCase().includes("test your app") && f.text.toLowerCase().includes("computer");

  return (
    <Card
      className={`relative flex h-full flex-col ${
        plan.highlighted
          ? "ring-2 ring-[var(--semantic-success)] border-[var(--semantic-success)]"
          : ""
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--semantic-success)] px-3 py-0.5 text-xs font-medium text-white">
          Most Popular
        </div>
      )}
      {/* Fixed min-height so first feature row aligns across cards */}
      <div className="mb-4 min-h-[72px]">
        <h3 className="text-heading-card">{plan.name}</h3>
        <p className="text-body-muted mt-1 text-sm">{plan.description}</p>
      </div>
      <div className="mb-6 min-h-[64px]">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-[var(--text-primary)]">
            ${plan.monthlyPrice}
          </span>
          <span className="text-[var(--text-tertiary)]">/month</span>
        </div>
        <p className="text-caption mt-1">
          {plan.promptsPerMonth.toLocaleString()} prompts/month
        </p>
        {plan.overageNote && (
          <p className="text-caption mt-1 text-[var(--text-tertiary)]">
            {plan.overageNote}
          </p>
        )}
      </div>
      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((f, i) => (
          <li key={i}>
            <div
              className={`flex items-start gap-2 text-sm ${
                f.included ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]"
              }`}
            >
              <span
                className="mt-0.5 shrink-0"
                aria-hidden
              >
                {f.included ? (
                  <span className="text-[var(--semantic-success)]">✓</span>
                ) : (
                  <span className="text-[var(--text-tertiary)]">—</span>
                )}
              </span>
              <span className="flex-1">
                {f.text}
                {f.included && isSimulatorFeature(f) && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={onOpenSimulatorExplanation}
                      className="text-[var(--link-default)] hover:underline text-xs"
                    >
                      What is this?
                    </button>
                  </>
                )}
              </span>
            </div>
            {plan.simulatorAddOnNote && f.included && isSimulatorFeature(f) && (
              <div className="mt-1 pl-5 space-y-0.5">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {SIMULATOR_SUBTITLE}
                </p>
                <p className="text-xs italic text-[var(--text-tertiary)]">
                  {SIMULATOR_ADDON_NOTE}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div>
        <Link href="/dashboard" className="block">
          <Button variant={variant} className="w-full">
            {plan.cta}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function PricingPage() {
  const [simulatorExplanationOpen, setSimulatorExplanationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <Nav />
      <main>
        {/* Hero */}
        <section className="border-b border-[var(--border-default)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-heading-hero mb-4">Simple pricing</h1>
            <p className="text-body-muted text-lg">
              One credit system for AI and builds. Start free, upgrade when you're ready to ship.
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
              We asked three pricing strategists with decades of experience to review Vibetree's features and recommend plans and prices. Here's the synthesis.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              <Card>
                <h3 className="text-heading-card mb-2">Value-based</h3>
                <p className="text-body-muted text-sm">
                  Price by outcome: learn (Free), ship (Starter), scale (Builder, Pro). Starter $25/mo, Builder $50/mo, Pro $100/mo with publish and run on device.
                </p>
              </Card>
              <Card>
                <h3 className="text-heading-card mb-2">Usage-based</h3>
                <p className="text-body-muted text-sm">
                  Transparent prompts per month: 5 (Free), 25 (Starter), 50 (Builder), 100 (Pro). Overages at $1.00 per prompt on Pro.
                </p>
              </Card>
              <Card>
                <h3 className="text-heading-card mb-2">Competitive</h3>
                <p className="text-body-muted text-sm">
                  Generous free tier, then clear upgrades for run on device, code export, and App Store publish. No annual lock-in; all plans billed monthly.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="px-4 py-12 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onOpenSimulatorExplanation={() => setSimulatorExplanationOpen(true)}
                />
              ))}
            </div>

            <p className="text-caption mt-10 text-center text-[var(--text-tertiary)]">
              All plans billed monthly. Pricing subject to change. 1 prompt = $1.00 across all paid plans.
            </p>
          </div>
        </section>
      </main>
      <Footer />

      <SimulatorExplanationModal
        isOpen={simulatorExplanationOpen}
        onClose={() => setSimulatorExplanationOpen(false)}
      />
    </div>
  );
}
