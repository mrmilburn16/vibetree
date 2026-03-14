"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { PLANS, type Plan, type PlanFeature } from "@/lib/pricing";
import { isPaidPlanId } from "@/lib/stripe";

const SIMULATOR_ADDON_NOTE = "Simulator available as add-on — $0.20/min, pay as you go";
const SIMULATOR_SUBTITLE =
  "See your full UI and UX in your browser. Haptic feedback and some hardware features not supported.";

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
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        Test your app directly in your browser without needing your iPhone. Tap through screens,
        validate your UI and UX, and see how your app feels — all on your computer. Note: haptic
        feedback and some hardware features aren&apos;t supported. Billed at $0.20/min from a
        prepaid wallet balance. You load funds upfront — no surprise charges, no unpaid bills. When
        your balance runs out, the session ends automatically.
      </p>
    </Modal>
  );
}

function PlanCard({
  plan,
  onOpenSimulatorExplanation,
  onSelectPlan,
  isLoading,
}: {
  plan: Plan;
  onOpenSimulatorExplanation: () => void;
  onSelectPlan: (planId: string) => void;
  isLoading?: boolean;
}) {
  const variant = plan.ctaVariant ?? "primary";
  const isSimulatorFeature = (f: PlanFeature) =>
    f.text.toLowerCase().includes("test your app") && f.text.toLowerCase().includes("computer");

  return (
    <Card
      className={`relative flex h-full flex-col ${
        plan.highlighted
          ? "border-[var(--semantic-success)] ring-2 ring-[var(--semantic-success)]"
          : ""
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--semantic-success)] px-3 py-0.5 text-xs font-medium text-white">
          Most Popular
        </div>
      )}
      <div className="mb-4 min-h-[72px]">
        <h3 className="text-heading-card">{plan.name}</h3>
        <p className="text-body-muted mt-1 text-sm">{plan.description}</p>
      </div>
      <div className="mb-6 min-h-[64px]">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-[var(--text-primary)]">${plan.monthlyPrice}</span>
          <span className="text-[var(--text-tertiary)]">/month</span>
        </div>
        <p className="text-caption mt-1">{plan.promptsPerMonth.toLocaleString()} prompts/month</p>
        {plan.overageNote && (
          <p className="text-caption mt-1 text-[var(--text-tertiary)]">{plan.overageNote}</p>
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
              <span className="mt-0.5 shrink-0" aria-hidden>
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
                      className="text-xs text-[var(--link-default)] hover:underline"
                    >
                      What is this?
                    </button>
                  </>
                )}
              </span>
            </div>
            {plan.simulatorAddOnNote && f.included && isSimulatorFeature(f) && (
              <div className="mt-1 space-y-0.5 pl-5">
                <p className="text-xs text-[var(--text-tertiary)]">{SIMULATOR_SUBTITLE}</p>
                <p className="text-xs italic text-[var(--text-tertiary)]">{SIMULATOR_ADDON_NOTE}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant={variant}
          className="w-full"
          onClick={() => onSelectPlan(plan.id)}
          disabled={isLoading}
        >
          {isLoading ? "Redirecting…" : plan.cta}
        </Button>
      </div>
    </Card>
  );
}

/**
 * Reusable pricing plan grid with Stripe checkout logic.
 * Renders the four plan cards and handles the create-checkout flow.
 * Used on the /pricing page and inside PricingModal.
 */
export function PricingTable({ onSelectSuccess }: { onSelectSuccess?: () => void }) {
  const router = useRouter();
  const [simulatorExplanationOpen, setSimulatorExplanationOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (planId === "free") {
      router.push("/dashboard");
      onSelectSuccess?.();
      return;
    }
    if (!isPaidPlanId(planId)) return;
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const returnUrl = encodeURIComponent(
          typeof window !== "undefined" ? window.location.pathname : "/pricing"
        );
        router.push(`/sign-in?returnUrl=${returnUrl}`);
        return;
      }
      if (!res.ok) {
        setCheckoutError("Something went wrong — please try again.");
        console.error("[PricingTable] create-checkout failed", res.status, data);
        return;
      }
      if (typeof data.url === "string") {
        window.location.href = data.url;
        return;
      }
      setCheckoutError("Something went wrong — please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      {checkoutError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-[var(--text-primary)]">{checkoutError}</p>
          <button
            type="button"
            onClick={() => setCheckoutError(null)}
            className="shrink-0 text-sm font-medium text-[var(--link-default)] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onOpenSimulatorExplanation={() => setSimulatorExplanationOpen(true)}
            onSelectPlan={handleSelectPlan}
            isLoading={checkoutLoading}
          />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-[var(--text-tertiary)]">
        All plans billed monthly. Pricing subject to change.
      </p>

      <SimulatorExplanationModal
        isOpen={simulatorExplanationOpen}
        onClose={() => setSimulatorExplanationOpen(false)}
      />
    </>
  );
}
