"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { CREDIT_USAGE } from "@/lib/pricing";
import { PricingTable } from "@/components/pricing/PricingTable";

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

export default function PricingPage() {
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
            <p className="text-body-muted mt-6">
              When your generated app uses external APIs (weather, stocks, maps, AI), calls go through our proxy and are deducted from credits automatically.{" "}
              <Link href="/pricing/apis" className="text-[var(--link-default)] hover:underline font-medium">
                App API usage pricing →
              </Link>
            </p>
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
            <PricingTable />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
