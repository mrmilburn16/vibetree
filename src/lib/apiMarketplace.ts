/**
 * API Marketplace / proxy registry.
 * Defines supported external APIs: our cost, user price, markup, and enabled state.
 * Generated apps call /api/proxy/[proxySlug]; we make the real call with our key and bill the user.
 */

export type ApiMarketplaceEntry = {
  id: string;
  /** URL segment for /api/proxy/[proxySlug] */
  proxySlug: string;
  name: string;
  category: string;
  /** What we pay per call (USD). null = note only, no per-call billing. */
  costPerCallUsd: number | null;
  /** What we charge the user per call (USD or credits). null = note only. */
  userPricePerCallUsd: number | null;
  /** Markup % (derived: (userPrice - cost) / cost * 100). null when cost is 0 or note-only. */
  markupPercent: number | null;
  enabled: boolean;
  /** Optional note for display (e.g. "No per-call cost") */
  note?: string;
};

function markupPercent(cost: number | null, userPrice: number | null): number | null {
  if (cost == null || userPrice == null || cost <= 0) return null;
  return Math.round(((userPrice - cost) / cost) * 100);
}

/** In-memory registry. Later can be moved to DB or config. */
let registry: ApiMarketplaceEntry[] = [
  {
    id: "openweathermap",
    proxySlug: "weather",
    name: "OpenWeatherMap",
    category: "Weather",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0,
    markupPercent: 0,
    enabled: true,
  },
  {
    id: "finnhub",
    proxySlug: "finnhub",
    name: "Finnhub",
    category: "Stock Data",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0,
    markupPercent: 0,
    enabled: true,
  },
  {
    id: "plant-id",
    proxySlug: "plant-identify",
    name: "Plant.id",
    category: "Plant Recognition",
    costPerCallUsd: 0.08,
    userPricePerCallUsd: 0.12,
    markupPercent: markupPercent(0.08, 0.12),
    enabled: true,
  },
  {
    id: "stripe",
    proxySlug: "stripe",
    name: "Stripe",
    category: "Payments",
    costPerCallUsd: null,
    userPricePerCallUsd: null,
    markupPercent: null,
    enabled: true,
    note: "Note only; no per-call cost",
  },
  {
    id: "revenuecat",
    proxySlug: "revenuecat",
    name: "RevenueCat",
    category: "In-App Purchases",
    costPerCallUsd: null,
    userPricePerCallUsd: null,
    markupPercent: null,
    enabled: true,
    note: "Note only; no per-call cost",
  },
  {
    id: "google-maps",
    proxySlug: "google-maps",
    name: "Google Maps",
    category: "Maps & Location",
    costPerCallUsd: 0.005,
    userPricePerCallUsd: 0.01,
    markupPercent: markupPercent(0.005, 0.01),
    enabled: true,
  },
];

export function getApiMarketplaceEntries(): ApiMarketplaceEntry[] {
  return [...registry];
}

export function getApiMarketplaceEntryBySlug(proxySlug: string): ApiMarketplaceEntry | undefined {
  return registry.find((e) => e.proxySlug === proxySlug);
}

export function setApiMarketplaceEnabled(id: string, enabled: boolean): void {
  const entry = registry.find((e) => e.id === id);
  if (entry) entry.enabled = enabled;
}

export function updateApiMarketplaceRegistry(entries: ApiMarketplaceEntry[]): void {
  registry = entries.map((e) => ({
    ...e,
    markupPercent:
      e.costPerCallUsd != null && e.userPricePerCallUsd != null && e.costPerCallUsd > 0
        ? markupPercent(e.costPerCallUsd, e.userPricePerCallUsd)
        : null,
  }));
}
