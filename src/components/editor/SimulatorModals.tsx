"use client";

import { useState, useEffect } from "react";
import { Button, Modal } from "@/components/ui";

const RATE_CENTS_PER_MIN = 20; // $0.20/min

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Modal when balance is $0 — offer $5, $10, $25 top-up. Mock success. */
export function SimulatorTopUpModal({
  isOpen,
  onClose,
  onTopUpSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onTopUpSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTopUp = async (amount: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulator-wallet/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Top-up failed");
        return;
      }
      onTopUpSuccess();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Top up your simulator wallet to get started"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Add funds to your prepaid simulator balance. You&apos;ll be charged $0.20/min when the simulator is running.
      </p>
      {error && (
        <p className="text-sm text-[var(--semantic-error)] mb-4">{error}</p>
      )}
      <div className="flex gap-3">
        {[5, 10, 25].map((amount) => (
          <Button
            key={amount}
            variant="primary"
            disabled={loading}
            onClick={() => handleTopUp(amount)}
          >
            ${amount}
          </Button>
        ))}
      </div>
    </Modal>
  );
}

/** Confirmation before starting simulator: app name, balance, estimated time, checkbox. */
export function SimulatorConfirmModal({
  isOpen,
  onClose,
  appName,
  balanceCents,
  onStart,
}: {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  balanceCents: number;
  onStart: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const estimatedMins = Math.floor(balanceCents / RATE_CENTS_PER_MIN);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start simulator"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!checked}
            onClick={() => {
              onStart();
              onClose();
            }}
          >
            Start simulator
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-[var(--text-secondary)]">
        <p><strong className="text-[var(--text-primary)]">App:</strong> {appName}</p>
        <p><strong className="text-[var(--text-primary)]">Current balance:</strong> {formatDollars(balanceCents)}</p>
        <p>Your balance ≈ ~{estimatedMins} min at $0.20/min.</p>
        <label className="flex items-start gap-2 cursor-pointer mt-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 rounded border-[var(--border-default)]"
          />
          <span>I understand simulator usage is billed at $0.20/min from my wallet balance.</span>
        </label>
      </div>
    </Modal>
  );
}

/** Floating pill during session: timer, cost, balance, End session. */
export function SimulatorSessionPill({
  sessionStartTime,
  initialBalanceCents,
  balanceCents,
  onEndSession,
  lowBalanceWarning,
}: {
  sessionStartTime: number;
  initialBalanceCents: number;
  balanceCents: number;
  onEndSession: () => void;
  lowBalanceWarning: boolean;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [costCents, setCostCents] = useState(0);

  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      setElapsedSeconds(elapsed);
      const mins = elapsed / 60;
      setCostCents(Math.min(Math.floor(mins * RATE_CENTS_PER_MIN), initialBalanceCents));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime, initialBalanceCents]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3 shadow-lg">
      {lowBalanceWarning && (
        <p className="text-xs font-medium text-[var(--semantic-warning)]">
          Low balance — less than 5 min remaining
        </p>
      )}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-[var(--text-primary)]">{formatTime(elapsedSeconds)}</span>
        <span className="text-[var(--text-secondary)]">— {formatDollars(costCents)}</span>
        <span className="text-[var(--text-tertiary)]">Balance: {formatDollars(balanceCents)} remaining</span>
      </div>
      <Button variant="secondary" size="sm" onClick={onEndSession}>
        End session
      </Button>
    </div>
  );
}

/** Summary after session ends. */
export function SimulatorSummaryModal({
  isOpen,
  onClose,
  sessionSeconds,
  costCents,
  balanceCentsAfter,
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionSeconds: number;
  costCents: number;
  balanceCentsAfter: number;
}) {
  const mins = Math.floor(sessionSeconds / 60);
  const secs = sessionSeconds % 60;
  const timeStr = mins > 0 ? `${mins} min ${secs} sec` : `${secs} sec`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulator session ended"
      footer={
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        <p><strong className="text-[var(--text-primary)]">Session time:</strong> {timeStr}</p>
        <p><strong className="text-[var(--text-primary)]">Total cost:</strong> {formatDollars(costCents)}</p>
        <p><strong className="text-[var(--text-primary)]">Remaining balance:</strong> {formatDollars(balanceCentsAfter)}</p>
      </div>
    </Modal>
  );
}

/** Shown when balance runs out mid-session. */
export function SimulatorBalanceRanOutModal({
  isOpen,
  onClose,
  onTopUp,
}: {
  isOpen: boolean;
  onClose: () => void;
  onTopUp: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulator balance ran out"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={onTopUp}>
            Top up
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-secondary)]">
        Your simulator balance ran out. Top up to continue.
      </p>
    </Modal>
  );
}
