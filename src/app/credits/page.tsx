"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCredits } from "@/contexts/CreditsContext";
import { Button, Input } from "@/components/ui";
import { CREDIT_PACKS, PRICE_PER_CREDIT_USD } from "@/lib/credits";

export default function CreditsPage() {
  const router = useRouter();
  const { balance, add, setBalance } = useCredits();
  const [purchased, setPurchased] = useState<string | null>(null);
  const [testBalance, setTestBalance] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const session = localStorage.getItem("vibetree-session");
    if (!session) router.replace("/sign-in");
  }, [router]);

  function handlePurchase(packId: string, credits: number) {
    add(credits);
    setPurchased(packId);
  }

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/90 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--link-default)]"
          >
            Back to dashboard
          </Link>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Balance: <strong>{balance} {balance === 1 ? "credit" : "credits"}</strong>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Buy credits
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">1 credit = ${PRICE_PER_CREDIT_USD.toFixed(2)}</strong>.
          Each message uses 1 credit. Purchased credits don&apos;t expire.
        </p>
        <p className="mt-1 text-[var(--text-secondary)]">
          Same price per credit, no matter how many you buy.
        </p>

        {purchased && (
          <div
            className="mt-6 rounded-[var(--radius-lg)] border border-[var(--semantic-success)]/40 bg-[var(--semantic-success)]/10 px-4 py-3 text-sm text-[var(--semantic-success)]"
            role="alert"
          >
            Credits added. Your balance has been updated. (This is a demo — no payment was taken.)
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-6 transition-colors hover:border-[var(--button-primary-bg)]/40"
            >
              <p className="text-2xl font-bold text-[var(--text-primary)]">{pack.label}</p>
              <p className="mt-1 text-3xl font-bold text-[var(--link-default)]">${pack.priceUsd}</p>
              <div className="mt-6 flex-1" />
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handlePurchase(pack.id, pack.credits)}
              >
                Get {pack.label}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-[var(--text-tertiary)]">
          Need a different amount? <Link href="/contact" className="text-[var(--link-default)] hover:underline">Contact us</Link>.
        </p>

        <section className="mt-14 border-t border-[var(--border-default)] pt-10">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Testing</h2>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Set your balance to simulate low or out of credits (e.g. 0 or 5).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              step={1}
              placeholder={String(balance)}
              value={testBalance}
              onChange={(e) => setTestBalance(e.target.value)}
              className="w-24"
              aria-label="Balance for testing"
            />
            <Button
              variant="secondary"
              onClick={() => {
                const n = parseInt(testBalance, 10);
                if (!Number.isNaN(n) && n >= 0) {
                  setBalance(n);
                  setTestBalance("");
                }
              }}
            >
              Set balance
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
