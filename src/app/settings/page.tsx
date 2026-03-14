"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { useSimulatorWallet } from "@/hooks/useSimulatorWallet";
import {
  SimulatorTopUpModal,
} from "@/components/editor/SimulatorModals";

const THEMES = [
  { value: "emerald",        label: "Forest",                   color: "#10B981", mode: "dark"  },
  { value: "violet",         label: "Twilight Violet",          color: "#6366F1", mode: "dark"  },
  { value: "amber",          label: "Amber",                    color: "#F59E0B", mode: "dark"  },
  { value: "ocean",          label: "Ocean",                    color: "#0EA5E9", mode: "dark"  },
  { value: "rose",           label: "Rose",                     color: "#F43F5E", mode: "dark"  },
  { value: "slate",          label: "Slate",                    color: "#64748B", mode: "dark"  },
  { value: "teal",           label: "Teal",                     color: "#14B8A6", mode: "dark"  },
  { value: "fuchsia",        label: "Fuchsia",                  color: "#D946EF", mode: "dark"  },
  { value: "sky",            label: "Sky",                      color: "#0284C7", mode: "dark"  },
  { value: "lime",           label: "Lime",                     color: "#84CC16", mode: "dark"  },
  { value: "white",          label: "White",                    color: "#FFFFFF", mode: "dark"  },
  { value: "emerald-light",  label: "Forest (Light)",           color: "#10B981", mode: "light" },
  { value: "violet-light",   label: "Twilight Violet (Light)",  color: "#6366F1", mode: "light" },
  { value: "amber-light",    label: "Amber (Light)",            color: "#F59E0B", mode: "light" },
  { value: "ocean-light",    label: "Ocean (Light)",            color: "#0EA5E9", mode: "light" },
  { value: "rose-light",     label: "Rose (Light)",             color: "#F43F5E", mode: "light" },
  { value: "slate-light",    label: "Slate (Light)",            color: "#64748B", mode: "light" },
  { value: "teal-light",     label: "Teal (Light)",             color: "#14B8A6", mode: "light" },
  { value: "fuchsia-light",  label: "Fuchsia (Light)",          color: "#D946EF", mode: "light" },
  { value: "sky-light",      label: "Sky (Light)",              color: "#0284C7", mode: "light" },
  { value: "lime-light",     label: "Lime (Light)",             color: "#84CC16", mode: "light" },
  { value: "white-light",    label: "White (Light)",            color: "#FFFFFF", mode: "light" },
] as const;

const THEME_STORAGE_KEY = "vibetree-theme";

function getActiveTheme(): string {
  if (typeof document === "undefined") return "emerald";
  return document.documentElement.getAttribute("data-theme") ?? "emerald";
}

function applyTheme(value: string) {
  document.documentElement.setAttribute("data-theme", value);
  try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch (_) {}
}

type PreflightResult = {
  runner: { ok: boolean; runnerId?: string };
  device: { ok: boolean; name?: string; id?: string };
  teamId: { ok: boolean; value?: string };
  files: { ok: boolean; count?: number };
};

async function fetchTeamIdForPreflight(): Promise<string> {
  try {
    const res = await fetch("/api/user/development-team", { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json()) as { developmentTeamId?: string };
    return typeof data.developmentTeamId === "string" ? data.developmentTeamId.trim() : "";
  } catch {
    return "";
  }
}

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

type SubscriptionInfo = {
  active: boolean;
  planId: string;
  status: string | null;
  currentPeriodEnd: number | null;
};

export default function SettingsPage() {
  const { balanceCents, transactions, loading, refresh, error } = useSimulatorWallet();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [preflightChecks, setPreflightChecks] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [activeTheme, setActiveTheme] = useState("emerald");
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTheme(getActiveTheme());
  }, []);

  useEffect(() => {
    fetch("/api/subscription", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SubscriptionInfo | null) => { if (data) setSubscription(data); })
      .catch(() => {});
  }, []);

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    try {
      const teamId = await fetchTeamIdForPreflight();
      const q = new URLSearchParams();
      if (teamId) q.set("teamId", teamId);
      const res = await fetch(`/api/macos/preflight?${q.toString()}`);
      if (res.ok) {
        const data: PreflightResult = await res.json();
        setPreflightChecks(data);
      }
    } catch {
      setPreflightChecks(null);
    } finally {
      setPreflightLoading(false);
    }
  }, []);

  useEffect(() => {
    runPreflight();
  }, [runPreflight]);

  const proPreflightReady =
    preflightChecks != null &&
    preflightChecks.runner.ok &&
    preflightChecks.device.ok &&
    preflightChecks.teamId.ok;

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
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Account Settings</h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* iPhone readiness section */}
        <section id="iphone" className="mb-10">
          <h2 className="text-heading-section mb-1">Run on iPhone</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Required for Pro (Swift) builds. All three must pass before you can build and install.
          </p>
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                Readiness check
              </span>
              <button
                type="button"
                onClick={runPreflight}
                disabled={preflightLoading}
                className="text-xs text-[var(--link-default)] hover:underline disabled:opacity-50"
              >
                {preflightLoading ? "Checking…" : "Re-check"}
              </button>
            </div>
            <div className="space-y-4">
              {/* Mac runner */}
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {preflightLoading && !preflightChecks ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--button-primary-bg)]" />
                  ) : preflightChecks?.runner.ok ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-red-400">✗</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Mac runner</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {preflightChecks?.runner.ok
                      ? `Connected${preflightChecks.runner.runnerId ? ` (${preflightChecks.runner.runnerId})` : ""}`
                      : "Run npm run mac-runner in the project root to start it"}
                  </p>
                </div>
              </div>

              {/* iPhone */}
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {preflightLoading && !preflightChecks ? null : preflightChecks?.device.ok ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-red-400">✗</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">iPhone connected</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {preflightChecks?.device.ok
                      ? (preflightChecks.device.name ?? "Detected")
                      : "Connect your iPhone via USB or ensure it's on the same Wi-Fi network"}
                  </p>
                </div>
              </div>

              {/* Team ID */}
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {preflightLoading && !preflightChecks ? null : preflightChecks?.teamId.ok ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-red-400">✗</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Developer Team ID</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {preflightChecks?.teamId.ok
                      ? preflightChecks.teamId.value
                      : "Set your Apple Team ID via Run on Device in the editor, or in Project Settings"}
                  </p>
                </div>
              </div>
            </div>

            {preflightChecks && !proPreflightReady && (
              <p className="mt-4 rounded-lg bg-[var(--semantic-warning)]/10 px-3 py-2 text-xs text-[var(--semantic-warning)]">
                Fix the items above before building to avoid wasting credits.
              </p>
            )}
            {proPreflightReady && (
              <p className="mt-4 rounded-lg bg-green-400/10 px-3 py-2 text-xs text-green-400">
                All checks passed — you&apos;re ready to build and install to your iPhone.
              </p>
            )}
          </Card>
        </section>

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

        {/* Subscription section */}
        <section className="mb-10">
          <h2 className="text-heading-section mb-1">Subscription</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Your current plan and billing details.
          </p>
          <Card className="p-4 sm:p-5">
            {subscription ? (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold capitalize text-[var(--text-primary)]">
                    {subscription.planId === "free"
                      ? "Free"
                      : subscription.planId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    {" "}plan
                  </p>
                  {subscription.status && subscription.planId !== "free" && (
                    <p className={`text-xs capitalize ${
                      subscription.status === "active" ? "text-green-400"
                      : subscription.status === "past_due" ? "text-yellow-400"
                      : "text-[var(--text-tertiary)]"
                    }`}>
                      {subscription.status.replace(/_/g, " ")}
                    </p>
                  )}
                  {subscription.currentPeriodEnd && subscription.planId !== "free" && (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {subscription.planId === "free" && (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      <Link href="/pricing" className="text-[var(--link-default)] hover:underline">
                        Upgrade to a paid plan
                      </Link>{" "}to unlock more prompts and features.
                    </p>
                  )}
                </div>
                {subscription.planId !== "free" && (
                  <div className="shrink-0">
                    {portalError && (
                      <p className="mb-2 text-xs text-[var(--semantic-error)]">{portalError}</p>
                    )}
                    <Button
                      variant="secondary"
                      disabled={portalLoading}
                      onClick={async () => {
                        setPortalLoading(true);
                        setPortalError(null);
                        try {
                          const res = await fetch("/api/stripe/create-portal-session", {
                            method: "POST",
                            credentials: "include",
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && typeof data.url === "string") {
                            window.location.href = data.url;
                            return;
                          }
                          setPortalError(typeof data.error === "string" ? data.error : "Could not open billing portal.");
                        } finally {
                          setPortalLoading(false);
                        }
                      }}
                    >
                      {portalLoading ? "Opening…" : "Manage subscription"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">Loading…</p>
            )}
          </Card>
        </section>

        {/* Theme section */}
        <section className="mb-10">
          <h2 className="text-heading-section mb-1">Theme</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Choose a colour and mode for the app.
          </p>
          <Card className="p-4 sm:p-5 space-y-5">
            {(["dark", "light"] as const).map((mode) => (
              <div key={mode}>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {mode === "dark" ? "Dark" : "Light"}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {THEMES.filter((t) => t.mode === mode).map((t) => {
                    const isActive = t.value === activeTheme;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        title={t.label}
                        aria-label={t.label}
                        aria-pressed={isActive}
                        onClick={() => {
                          applyTheme(t.value);
                          setActiveTheme(t.value);
                        }}
                        className={`group flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/50 ${
                          isActive
                            ? "bg-[var(--button-primary-bg)]/15 ring-2 ring-[var(--button-primary-bg)]/60"
                            : "hover:bg-[var(--background-tertiary)]"
                        }`}
                      >
                        <span
                          className="h-7 w-7 rounded-full shadow-sm"
                          style={{
                            backgroundColor: t.color,
                            border: t.color === "#FFFFFF"
                              ? "2px solid rgba(0,0,0,0.35)"
                              : mode === "light"
                              ? "2px solid rgba(0,0,0,0.12)"
                              : "2px solid rgba(255,255,255,0.18)",
                          }}
                        />
                        <span className="max-w-[68px] text-center text-[10px] leading-tight text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]">
                          {t.label.replace(" (Light)", "")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
