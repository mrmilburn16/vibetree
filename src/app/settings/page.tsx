"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { useSimulatorWallet } from "@/hooks/useSimulatorWallet";
import {
  SimulatorTopUpModal,
} from "@/components/editor/SimulatorModals";

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const { balanceCents, transactions, loading, refresh, error } = useSimulatorWallet();
  const [topUpOpen, setTopUpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--link-default)]"
          >
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Simulator wallet section */}
        <section className="mb-10">
          <h2 className="text-heading-section mb-4">Simulator wallet</h2>
          <Card className="p-6">
            {loading && !transactions.length ? (
              <p className="text-sm text-[var(--text-tertiary)]">Loading…</p>
            ) : error ? (
              <p className="text-sm text-[var(--semantic-error)]">{error}</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-caption text-[var(--text-tertiary)]">Current balance</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {formatDollars(balanceCents)}
                    </p>
                  </div>
                  <Button variant="primary" onClick={() => setTopUpOpen(true)}>
                    Top up
                  </Button>
                </div>
                {balanceCents <= 0 && (
                  <p className="text-sm text-[var(--text-tertiary)] mb-4">
                    Add funds to start using the simulator.
                  </p>
                )}
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                  Transaction history
                </h3>
                {transactions.length === 0 ? (
                  <p className="text-caption text-[var(--text-tertiary)]">
                    No transactions yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-default)] bg-[var(--background-tertiary)]">
                          <th className="px-3 py-2 font-medium text-[var(--text-primary)]">Date</th>
                          <th className="px-3 py-2 font-medium text-[var(--text-primary)]">Type</th>
                          <th className="px-3 py-2 font-medium text-[var(--text-primary)]">Amount</th>
                          <th className="px-3 py-2 font-medium text-[var(--text-primary)]">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="text-[var(--text-secondary)]">
                        {transactions.map((t, i) => (
                          <tr key={i} className="border-b border-[var(--border-default)] last:border-0">
                            <td className="px-3 py-2 text-xs">{formatDate(t.date)}</td>
                            <td className="px-3 py-2 capitalize">{t.type === "topup" ? "Top-up" : "Session"}</td>
                            <td className="px-3 py-2">
                              {t.type === "topup" ? "+" : "-"}
                              {formatDollars(t.amountCents)}
                            </td>
                            <td className="px-3 py-2">{formatDollars(t.balanceAfterCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Card>
        </section>
      </main>

      <SimulatorTopUpModal
        isOpen={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        onTopUpSuccess={() => {
          refresh();
          setTopUpOpen(false);
        }}
      />
    </div>
  );
}
