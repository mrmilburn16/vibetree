/**
 * API Marketplace / proxy registry.
 * Defines supported external APIs: our cost, user price, markup, and enabled state.
 * Generated apps call /api/proxy/[proxySlug]; we make the real call with our key and bill the user.
 *
 * DEFAULTS live here (code). Runtime overrides (enabled, userPricePerCallUsd) are
 * stored in Firestore (collection: api_marketplace) and merged at request time via
 * apiMarketplaceFirestore.ts. This means price edits persist across restarts and
 * serverless instances without a redeploy.
 */

export type ApiMarketplaceEntry = {
  id: string;
  /** URL segment for /api/proxy/[proxySlug] */
  proxySlug: string;
  name: string;
  category: string;
  /** What we pay per call (USD). null = note only, no per-call billing. */
  costPerCallUsd: number | null;
  /** What we charge the user per call (USD). null = note only. */
  userPricePerCallUsd: number | null;
  /** Markup % (derived: (userPrice - cost) / cost * 100). null when cost is 0 or note-only. */
  markupPercent: number | null;
  enabled: boolean;
  /** Optional note for display (e.g. "No per-call cost") */
  note?: string;
  /** Daily free tier limit (calls/day). Only for free APIs; paid APIs are metered by credits. */
  dailyFreeLimit?: number;
};

export function calcMarkupPercent(
  cost: number | null,
  userPrice: number | null
): number | null {
  if (cost == null || userPrice == null || cost <= 0) return null;
  return Math.round(((userPrice - cost) / cost) * 100);
}

/** Hardcoded defaults. Never mutate this array directly — use Firestore overrides instead. */
export const API_MARKETPLACE_DEFAULTS: ApiMarketplaceEntry[] = [
  {
    id: "openweathermap",
    proxySlug: "weather",
    name: "OpenWeatherMap",
    category: "Weather",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0,
    markupPercent: 0,
    enabled: true,
    dailyFreeLimit: 50,
  },
  {
    id: "plant-id",
    proxySlug: "plant-identify",
    name: "Plant.id",
    category: "Plant Recognition",
    costPerCallUsd: 0.08,
    userPricePerCallUsd: 0.12,
    markupPercent: calcMarkupPercent(0.08, 0.12),
    enabled: true,
    dailyFreeLimit: 5,
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
    id: "anthropic-claude",
    proxySlug: "ai",
    name: "Anthropic Claude (AI)",
    category: "AI / LLM",
    costPerCallUsd: null,
    userPricePerCallUsd: 0.03,
    markupPercent: null,
    enabled: true,
    note: "Our cost is token-based (~$0.003–$0.008/call); user price = 0.3 credits ($0.03)",
    dailyFreeLimit: 10,
  },
  {
    id: "apple-mapkit",
    proxySlug: "places",
    name: "Apple MapKit (Places)",
    category: "Maps",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0,
    markupPercent: 0,
    enabled: true,
    note: "Apple MapKit free tier (25 k calls/day); no per-call charge",
    dailyFreeLimit: 50,
  },
  {
    id: "alpha-vantage-quote",
    proxySlug: "stock/quote",
    name: "Alpha Vantage (Stock Quote)",
    category: "Finance",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0,
    markupPercent: 0,
    enabled: true,
    note: "Shared free tier key; 25 req/day server-wide, responses cached 5 min",
  },
  {
    id: "alpha-vantage-daily",
    proxySlug: "stock/daily",
    name: "Alpha Vantage (Daily History)",
    category: "Finance",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0,
    markupPercent: 0,
    enabled: true,
    note: "Shared free tier key; 25 req/day server-wide, responses cached 1 h",
  },
  {
    id: "resend-email",
    proxySlug: "email",
    name: "Resend (Email)",
    category: "Email",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0.01,
    markupPercent: null,
    enabled: true,
    note: "Sends from apps@vibetree.app via Resend. Our cost ~$0.00 (free tier). User charged 0.1 credits per email after free tier.",
    dailyFreeLimit: 5,
  },
  {
    id: "unsplash-images",
    proxySlug: "images",
    name: "Unsplash (Image Search)",
    category: "Images",
    costPerCallUsd: 0,
    userPricePerCallUsd: 0,
    markupPercent: 0,
    enabled: true,
    note: "Unsplash demo tier: 50 req/hour shared. Responses cached 6 h. Requires photographer attribution.",
    dailyFreeLimit: 30,
  },
];

/**
 * Merge defaults with Firestore overrides.
 * overrides is a map of { [id]: { enabled?, userPricePerCallUsd? } }.
 * Returns a fresh array — does not mutate defaults.
 */
export function mergeWithOverrides(
  overrides: Record<string, { enabled?: boolean; userPricePerCallUsd?: number | null; costPerCallUsd?: number | null; dailyFreeLimit?: number | null }>
): ApiMarketplaceEntry[] {
  return API_MARKETPLACE_DEFAULTS.map((def) => {
    const ov = overrides[def.id];
    if (!ov) return { ...def };

    const userPrice =
      ov.userPricePerCallUsd !== undefined ? ov.userPricePerCallUsd : def.userPricePerCallUsd;
    const cost =
      ov.costPerCallUsd !== undefined ? ov.costPerCallUsd : def.costPerCallUsd;
    const enabled = ov.enabled !== undefined ? ov.enabled : def.enabled;
    const dailyFreeLimit =
      ov.dailyFreeLimit !== undefined ? (ov.dailyFreeLimit ?? undefined) : def.dailyFreeLimit;

    return {
      ...def,
      enabled,
      costPerCallUsd: cost,
      userPricePerCallUsd: userPrice,
      markupPercent: calcMarkupPercent(cost, userPrice),
      ...(dailyFreeLimit !== undefined ? { dailyFreeLimit } : {}),
    };
  });
}

// ── Legacy sync helpers (kept for compatibility; only work in single-process dev) ──

let _legacyOverrides: Record<string, { enabled?: boolean }> = {};

/** @deprecated Use Firestore-backed routes instead. */
export function getApiMarketplaceEntries(): ApiMarketplaceEntry[] {
  return mergeWithOverrides(_legacyOverrides);
}

/** @deprecated Use setMarketplaceOverride from apiMarketplaceFirestore.ts instead. */
export function setApiMarketplaceEnabled(id: string, enabled: boolean): void {
  _legacyOverrides[id] = { ..._legacyOverrides[id], enabled };
}

/** @deprecated */
export function getApiMarketplaceEntryBySlug(
  proxySlug: string
): ApiMarketplaceEntry | undefined {
  return API_MARKETPLACE_DEFAULTS.find((e) => e.proxySlug === proxySlug);
}

/** @deprecated */
export function updateApiMarketplaceRegistry(entries: ApiMarketplaceEntry[]): void {
  _legacyOverrides = {};
  entries.forEach((e) => {
    _legacyOverrides[e.id] = { enabled: e.enabled };
  });
}
