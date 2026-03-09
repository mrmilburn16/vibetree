"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Card } from "@/components/ui";

type PublicApiEntry = {
  id: string;
  proxySlug: string;
  name: string;
  category: string;
  userPricePerCallUsd: number | null;
  costPerCallUsd: number | null;
  note?: string;
};

const API_DESCRIPTIONS: Record<string, string> = {
  openweathermap: "Current weather and forecasts by city or GPS. Used by weather and fitness apps.",
  finnhub: "Real-time and historical stock quotes, company data, and market news. Used by finance and portfolio apps.",
  "plant-id": "Identify plants from a photo. Used by gardening and nature apps.",
  stripe: "Accept payments and subscriptions in your app. Setup and pricing via your Stripe account.",
  revenuecat: "In-app purchases and subscriptions. Setup and pricing via RevenueCat.",
  "google-maps": "Maps, places, and location services. Used by delivery, travel, and local discovery apps.",
};

function ApiCard({ entry }: { entry: PublicApiEntry }) {
  const description = API_DESCRIPTIONS[entry.id] ?? "External API available through the VibeTree proxy.";
  const isFree = entry.userPricePerCallUsd === 0 && entry.costPerCallUsd === 0;
  const isNoteOnly = entry.userPricePerCallUsd === null && entry.costPerCallUsd === null;

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-heading-card">{entry.name}</h3>
          <p className="text-xs text-[var(--text-tertiary)]">{entry.category}</p>
        </div>
        <span className="shrink-0">
          {isFree && (
            <span className="inline-flex items-center rounded-full bg-[var(--semantic-success)]/20 px-2.5 py-0.5 text-xs font-medium text-[var(--semantic-success)]">
              Free
            </span>
          )}
          {isNoteOnly && (
            <span className="inline-flex items-center rounded-full bg-[var(--background-tertiary)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              Contact us
            </span>
          )}
          {!isFree && !isNoteOnly && entry.userPricePerCallUsd != null && (
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              ${entry.userPricePerCallUsd.toFixed(3)} <span className="font-normal text-[var(--text-tertiary)]">/ call</span>
            </span>
          )}
        </span>
      </div>
      <p className="text-body-muted text-sm flex-1">{description}</p>
    </Card>
  );
}

export default function PricingApisPage() {
  const [entries, setEntries] = useState<PublicApiEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/api-marketplace/public")
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <Nav />
      <main>
        <section className="border-b border-[var(--border-default)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-heading-hero mb-4">App API pricing</h1>
            <p className="text-body-muted text-lg">
              When your generated app uses external APIs (weather, stocks, maps, AI, etc.),
              calls go through our proxy. You're charged per call — no API keys or setup required.
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
                  <Card key={i} className="h-32 animate-pulse bg-[var(--background-tertiary)]">
                    <span className="sr-only">Loading</span>
                  </Card>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <p className="text-body-muted">No APIs are currently listed. Check back later.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((entry) => (
                  <ApiCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}

            <div className="mt-8 rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3">
              <p className="text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">No setup required.</strong>{" "}
                API calls made by your generated app are deducted from your credits automatically.
                You don't need to sign up for OpenWeatherMap, Finnhub, or other providers — we handle the keys and billing.
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
