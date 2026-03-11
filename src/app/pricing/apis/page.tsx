"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Card, Modal } from "@/components/ui";
const DEFAULT_API_PREFERENCES: Record<string, boolean> = {
  openweathermap: true,
  "plant-id": false,
  stripe: false,
  revenuecat: false,
};

type PublicApiEntry = {
  id: string;
  proxySlug: string;
  name: string;
  category: string;
  userPricePerCallUsd: number | null;
  costPerCallUsd: number | null;
  note?: string;
  dailyFreeLimit?: number;
};

type SetupDifficulty = {
  label: string;
  color: "green" | "yellow" | "orange";
};

const SETUP_DIFFICULTY: Record<string, SetupDifficulty> = {
  openweathermap: { label: "No setup", color: "green" },
  "plant-id": { label: "No setup", color: "green" },
  stripe: { label: "Some setup", color: "yellow" },
  revenuecat: { label: "More setup", color: "orange" },
};

const API_DESCRIPTIONS: Record<string, string> = {
  openweathermap: "Current weather and forecasts by city or GPS. Used by weather and fitness apps.",
  finnhub: "Real-time and historical stock quotes, company data, and market news. Used by finance and portfolio apps.",
  "plant-id": "Identify plants from a photo. Used by gardening and nature apps.",
  stripe: "Accept payments and subscriptions in your app. Setup and pricing via your Stripe account.",
  revenuecat: "In-app purchases and subscriptions. Setup and pricing via RevenueCat.",
  "google-maps": "Maps, places, and location services. Used by delivery, travel, and local discovery apps.",
};

/** Per-API "What counts as a call?" examples for the enable confirmation modal. */
const CALL_EXAMPLES: Record<string, string> = {
  "plant-id":
    "Each time a user identifies a plant by taking a photo, that's 1 API call. If your app has 50 users who each identify 3 plants per day, that's 150 calls/day.",
  stripe:
    "Each payment or subscription action (e.g. checkout, subscription creation) counts as API usage. Billing is handled through your Stripe account.",
  revenuecat:
    "Each purchase or subscription check counts as a call. Billing is handled through your RevenueCat account.",
  "google-maps":
    "Each map load, place search, or directions request is 1 API call. Usage depends on how often your app uses maps or location features.",
  finnhub:
    "Each stock quote, company data, or market news request is 1 API call. Usage depends on how often your app fetches market data.",
};
const DEFAULT_CALL_EXAMPLE =
  "Each request your app makes to this API counts as one call. Check the API docs for typical usage patterns.";

function EnableApiModal({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: PublicApiEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const isNoteOnly = entry.userPricePerCallUsd === null && entry.costPerCallUsd === null;
  const costText = isNoteOnly
    ? entry.note ?? "Contact us"
    : `$${Number(entry.userPricePerCallUsd).toFixed(3)} / call`;
  const callExample = CALL_EXAMPLES[entry.id] ?? DEFAULT_CALL_EXAMPLE;

  useEffect(() => {
    let cancelled = false;
    setBalanceLoading(true);
    setBalance(null);
    fetch("/api/credits", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.balance === "number") setBalance(data.balance);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [entry.id]);

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={`Enable ${entry.name}?`}
      dialogClassName="max-w-md"
      footerClassName="justify-end gap-2"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-4 py-2 text-sm font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!understood}
            className="rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enable
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="mb-1.5 font-medium text-[var(--text-primary)]">How API calls work</h3>
          <p className="text-[var(--text-secondary)]">
            When your generated app uses {entry.name}, each API call is automatically routed through
            VibeTree&apos;s servers. You don&apos;t need your own API key — we handle everything. Each
            call deducts credits from your balance.
          </p>
        </section>
        <section>
          <h3 className="mb-1.5 font-medium text-[var(--text-primary)]">What counts as a call?</h3>
          <p className="text-[var(--text-secondary)]">{callExample}</p>
        </section>
        <section className="space-y-1">
          <p className="text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Cost:</span> {costText}
          </p>
          <p className="text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Your current balance:</span>{" "}
            {balanceLoading ? (
              <span className="text-[var(--text-tertiary)]">Loading…</span>
            ) : (
              <span className="text-[var(--semantic-success)]">
                {balance !== null ? `${balance} credits` : "—"}
              </span>
            )}
          </p>
        </section>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 rounded border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--button-primary-bg)] focus:ring-[var(--button-primary-bg)]"
          />
          <span className="text-[var(--text-secondary)]">
            I understand that API calls from my generated apps will be deducted from my credit
            balance automatically.
          </span>
        </label>
      </div>
    </Modal>
  );
}

const DIFFICULTY_CLASSES: Record<string, string> = {
  green: "bg-[var(--semantic-success)]/15 text-[var(--semantic-success)]",
  yellow: "bg-yellow-500/15 text-yellow-400",
  orange: "bg-orange-500/15 text-orange-400",
};

function SetupBadge({ difficulty }: { difficulty: SetupDifficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_CLASSES[difficulty.color]}`}
    >
      {difficulty.label}
    </span>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled ? "bg-[var(--semantic-success)]" : "bg-[var(--border-default)]"
      }`}
    >
      <span className="sr-only">{enabled ? "Disable" : "Enable"} API</span>
      <span
        aria-hidden
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
          enabled ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ApiLogo({ apiId }: { apiId: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <img
      src={`/images/api-logos/${apiId === "plant-id" ? "plantid" : apiId}.png`}
      alt=""
      width={28}
      height={28}
      className="h-7 w-7 shrink-0 rounded object-contain"
      onError={() => setVisible(false)}
    />
  );
}

function ApiRequestSection() {
  const [apiName, setApiName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => {
      setSuccess(false);
      setApiName("");
    }, 3000);
    return () => clearTimeout(t);
  }, [success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = apiName.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/api-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiName: trimmed }),
        credentials: "include",
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(res.status === 401 ? "Sign in to submit a request." : (data.error as string) || "Request failed.");
      }
    } catch {
      setError("Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-body-muted mb-4">Need an API that&apos;s not listed?</p>
        {success ? (
          <p
            className="text-body-muted mb-4 flex items-center justify-center gap-2 text-[var(--semantic-success)] transition-opacity duration-300"
            role="status"
          >
            <span aria-hidden className="text-lg">✓</span>
            Request submitted! We&apos;ll look into it.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mb-4 flex flex-wrap items-center justify-center gap-2"
          >
            <input
              type="text"
              value={apiName}
              onChange={(e) => setApiName(e.target.value)}
              placeholder="e.g. Spotify, Twilio, Google Maps..."
              className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--button-primary-bg)] min-w-[200px] max-w-[320px]"
              disabled={submitting}
              aria-label="API name to request"
            />
            <button
              type="submit"
              disabled={submitting || !apiName.trim()}
              className="rounded-full bg-[var(--button-secondary-bg)] px-3 py-2 text-sm font-medium text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/40"
            >
              Submit
            </button>
          </form>
        )}
        {error && (
          <p className="mb-4 text-sm text-[var(--semantic-error)]" role="alert">
            {error}
          </p>
        )}
        <Link
          href="/dashboard"
          className="text-[var(--link-default)] hover:underline text-sm font-medium"
        >
          ← Back to dashboard
        </Link>
      </div>
    </section>
  );
}

function ApiCard({
  entry,
  enabled,
  onToggle,
  saving,
}: {
  entry: PublicApiEntry;
  enabled: boolean;
  onToggle: () => void;
  saving: boolean;
}) {
  const description = API_DESCRIPTIONS[entry.id] ?? "External API available through the VibeTree proxy.";
  const isFree = entry.userPricePerCallUsd === 0 && entry.costPerCallUsd === 0;
  const isNoteOnly = entry.userPricePerCallUsd === null && entry.costPerCallUsd === null;
  const difficulty = SETUP_DIFFICULTY[entry.id];

  const pricingText = isFree
    ? "Free"
    : isNoteOnly
    ? entry.note ?? "Contact us"
    : entry.userPricePerCallUsd != null
    ? `$${entry.userPricePerCallUsd.toFixed(3)} / call`
    : null;

  return (
    <Card
      className={`flex h-full flex-col transition-opacity duration-200 ${
        enabled ? "opacity-100" : "opacity-50"
      }`}
    >
      {/* Header row: logo + name + toggle */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ApiLogo apiId={entry.id} />
          <div className="min-w-0">
            <h3 className="text-heading-card leading-tight">{entry.name}</h3>
            <p className="text-xs text-[var(--text-tertiary)]">{entry.category}</p>
          </div>
        </div>
        <ToggleSwitch enabled={enabled} onToggle={onToggle} disabled={saving} />
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] flex-1 mb-3">{description}</p>

      {/* Footer: setup badge + pricing + daily limit for free APIs */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          {difficulty && <SetupBadge difficulty={difficulty} />}
          {pricingText && (
            <span className="text-xs text-[var(--text-tertiary)]">{pricingText}</span>
          )}
        </div>
        {isFree && entry.dailyFreeLimit != null && (
          <p className="text-xs text-[var(--text-tertiary)]">
            {entry.dailyFreeLimit} calls/day included
          </p>
        )}
      </div>
    </Card>
  );
}

function isFreeApi(entry: PublicApiEntry): boolean {
  return entry.userPricePerCallUsd === 0 && entry.costPerCallUsd === 0;
}

export default function PricingApisPage() {
  const [entries, setEntries] = useState<PublicApiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<Record<string, boolean>>(DEFAULT_API_PREFERENCES);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [modalEntry, setModalEntry] = useState<PublicApiEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/api-marketplace/public")
        .then((r) => (r.ok ? r.json() : { entries: [] }))
        .catch(() => ({ entries: [] })),
      fetch("/api/user/api-preferences")
        .then((r) => (r.ok ? r.json() : { preferences: DEFAULT_API_PREFERENCES }))
        .catch(() => ({ preferences: DEFAULT_API_PREFERENCES })),
    ]).then(([marketplace, prefs]) => {
      if (cancelled) return;
      setEntries(marketplace.entries ?? []);
      setPreferences(prefs.preferences ?? DEFAULT_API_PREFERENCES);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const performEnable = useCallback(async (apiId: string) => {
    setSaving((prev) => ({ ...prev, [apiId]: true }));
    try {
      const res = await fetch("/api/user/api-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId, enabled: true }),
        credentials: "include",
      });
      if (res.ok) {
        setPreferences((prev) => ({ ...prev, [apiId]: true }));
      }
    } finally {
      setSaving((prev) => ({ ...prev, [apiId]: false }));
    }
  }, []);

  const handleToggle = useCallback(
    async (apiId: string) => {
      const entry = entries.find((e) => e.id === apiId);
      const next = !preferences[apiId];

      if (!next) {
        // Disable: no confirmation, save immediately
        setPreferences((prev) => ({ ...prev, [apiId]: false }));
        setSaving((prev) => ({ ...prev, [apiId]: true }));
        try {
          await fetch("/api/user/api-preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiId, enabled: false }),
            credentials: "include",
          });
        } catch {
          setPreferences((prev) => ({ ...prev, [apiId]: true }));
        } finally {
          setSaving((prev) => ({ ...prev, [apiId]: false }));
        }
        return;
      }

      if (entry && isFreeApi(entry)) {
        // Enable free API: no modal
        setPreferences((prev) => ({ ...prev, [apiId]: true }));
        setSaving((prev) => ({ ...prev, [apiId]: true }));
        try {
          await fetch("/api/user/api-preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiId, enabled: true }),
            credentials: "include",
          });
        } catch {
          setPreferences((prev) => ({ ...prev, [apiId]: false }));
        } finally {
          setSaving((prev) => ({ ...prev, [apiId]: false }));
        }
        return;
      }

      if (entry && !isFreeApi(entry)) {
        setModalEntry(entry);
      }
    },
    [entries, preferences]
  );

  const handleEnableConfirm = useCallback(() => {
    if (!modalEntry) return;
    const apiId = modalEntry.id;
    setModalEntry(null);
    performEnable(apiId);
  }, [modalEntry, performEnable]);

  const handleEnableCancel = useCallback(() => {
    setModalEntry(null);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      {modalEntry && (
        <EnableApiModal
          entry={modalEntry}
          onConfirm={handleEnableConfirm}
          onCancel={handleEnableCancel}
        />
      )}
      <Nav />
      <main>
        <section className="border-b border-[var(--border-default)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-heading-hero mb-4">App API pricing</h1>
            <p className="text-body-muted text-lg">
              When your generated app uses external APIs (weather, stocks, maps, AI, etc.),{" "}
              calls go through our proxy.
              <br />
              You're charged per call — no API keys or setup required.
            </p>
          </div>
        </section>

        <section className="border-b border-[var(--border-default)] px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-heading-section mb-2">Supported APIs</h2>
            <p className="text-body-muted mb-6">
              These APIs are available to your generated apps. Usage is deducted from your credit balance automatically.
            </p>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-36 animate-pulse bg-[var(--background-tertiary)]">
                    <span className="sr-only">Loading</span>
                  </Card>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <p className="text-body-muted">No APIs are currently listed. Check back later.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((entry) => (
                  <ApiCard
                    key={entry.id}
                    entry={entry}
                    enabled={preferences[entry.id] ?? DEFAULT_API_PREFERENCES[entry.id] ?? false}
                    onToggle={() => handleToggle(entry.id)}
                    saving={!!saving[entry.id]}
                  />
                ))}
              </div>
            )}

            <div className="mt-8 rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3">
              <p className="text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Most APIs work instantly with no setup</strong>{" "}
                — usage is deducted from your credits automatically. Some integrations like Stripe and RevenueCat require connecting your own account.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-body-muted mb-4">
              Need an API that's not listed? We're adding more over time.
            </p>
            <Link
              href="/pricing"
              className="text-[var(--link-default)] hover:underline text-sm font-medium"
            >
              ← Back to pricing
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
