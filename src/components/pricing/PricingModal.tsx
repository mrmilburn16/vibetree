"use client";

import { Modal } from "@/components/ui/Modal";
import { PricingTable } from "./PricingTable";

/**
 * Full-screen pricing overlay shown when a user runs out of credits,
 * hits a plan limit, or tries to use a paid-only feature.
 * The plan cards work identically to /pricing — clicking one starts Stripe checkout.
 */
export function PricingModal({
  isOpen,
  onClose,
  title = "You're out of credits",
  subtitle = "Choose a plan to keep building.",
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Override the modal heading. */
  title?: string;
  /** Override the sub-heading below the title. */
  subtitle?: string;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dialogClassName="max-w-5xl w-full"
    >
      <div className="pb-2">
        <h2 className="mb-1 text-xl font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="mb-6 text-sm text-[var(--text-secondary)]">{subtitle}</p>
        <PricingTable onSelectSuccess={onClose} />
      </div>
    </Modal>
  );
}
