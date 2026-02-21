"use client";

import Link from "next/link";
import { Modal } from "@/components/ui";

export function OutOfCreditsModal({
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
      title="You're out of credits"
      dialogClassName="max-w-sm"
      footerClassName="justify-center"
      footer={
        <Link
          href="/credits"
          onClick={onClose}
          className="rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-hover)]"
        >
          Buy credits
        </Link>
      }
    >
      <div className="py-4 text-center">
        <p className="text-[var(--text-secondary)]">
          Buy more credits to send messages.
          <br />
          Each message uses 1{"\u00A0"}credit.
        </p>
      </div>
    </Modal>
  );
}
