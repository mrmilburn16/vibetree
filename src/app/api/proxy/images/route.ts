/**
 * GET /api/proxy/images
 * Searches Unsplash for photos by keyword. Used by generated apps for stock image lookup.
 * Auth: X-App-Token header required.
 * Query params:
 *   query       (required) — search term, e.g. "beach house"
 *   count       (optional, default 5, max 10) — number of results
 *   orientation (optional) — landscape | portrait | squarish
 *   userId      (optional, recommended) — pass kUserId to enable per-user daily free tier tracking
 * Response: { results: UnsplashPhoto[] }
 * Cache: 6 hours per query+count+orientation combination.
 * Daily free limit: 30 calls/user/day (configurable from admin/api-costs).
 * Unsplash attribution: required by API guidelines — always show "Photo by [name] on Unsplash".
 * Download tracking: fires background requests to each photo's download_location after returning results.
 * Rate limit warning: logs when X-Ratelimit-Remaining drops below 10.
 */

import { NextResponse } from "next/server";
import { createProxyCache } from "@/lib/proxyCache";
import { logProxyCall } from "@/lib/proxyCallLog";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";
import { checkAndConsumeFreeTier } from "@/lib/proxyFreeTier";

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours
const MAX_COUNT = 10;
const DEFAULT_COUNT = 5;
const RATELIMIT_WARN_THRESHOLD = 10;

const imagesCache = createProxyCache({ ttlSeconds: CACHE_TTL_SECONDS });

export type UnsplashPhoto = {
  id: string;
  url: string;
  thumbUrl: string;
  smallUrl: string;
  regularUrl: string;
  photographer: string;
  photographerUrl: string;
  downloadUrl: string;
};

type UnsplashRawPhoto = {
  id: string;
  urls?: {
    full?: string;
    raw?: string;
    regular?: string;
    small?: string;
    thumb?: string;
  };
  user?: {
    name?: string;
    links?: { html?: string };
  };
  links?: {
    download_location?: string;
  };
};

type UnsplashSearchResponse = {
  results?: UnsplashRawPhoto[];
};

function normalizeToken(s: string | undefined): string {
  return (s ?? "").replace(/\r\n?|\n/g, "").trim();
}

function isAppTokenValid(request: Request): boolean {
  const appToken =
    process.env.VIBETREE_APP_TOKEN && normalizeToken(process.env.VIBETREE_APP_TOKEN);
  const headerToken = normalizeToken(
    request.headers.get("x-app-token") ?? request.headers.get("X-App-Token") ?? ""
  );
  return Boolean(appToken && headerToken && headerToken === appToken);
}

function mapPhoto(raw: UnsplashRawPhoto): UnsplashPhoto {
  const baseUrl = raw.urls?.raw ?? raw.urls?.full ?? "";
  const thumbUrl = raw.urls?.thumb ?? (baseUrl ? `${baseUrl}&w=200` : "");
  const smallUrl = raw.urls?.small ?? (baseUrl ? `${baseUrl}&w=400` : "");
  const regularUrl = raw.urls?.regular ?? (baseUrl ? `${baseUrl}&w=1080` : "");

  return {
    id: raw.id,
    url: raw.urls?.full ?? raw.urls?.raw ?? "",
    thumbUrl,
    smallUrl,
    regularUrl,
    photographer: raw.user?.name ?? "Unknown",
    photographerUrl: raw.user?.links?.html ?? "https://unsplash.com",
    downloadUrl: raw.links?.download_location ?? "",
  };
}

/** Fire-and-forget Unsplash download tracking (required by API guidelines). */
function triggerDownloadTracking(downloadLocations: string[], accessKey: string): void {
  for (const loc of downloadLocations) {
    if (!loc) continue;
    fetch(loc, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    }).catch(() => {});
  }
}

export async function GET(request: Request) {
  if (!isAppTokenValid(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();
  const userId = (searchParams.get("userId") ?? "").trim();
  const orientation = (searchParams.get("orientation") ?? "").trim();

  const countParam = searchParams.get("count");
  const count = Math.min(
    MAX_COUNT,
    Math.max(1, countParam != null ? Math.round(Number(countParam)) || DEFAULT_COUNT : DEFAULT_COUNT)
  );

  if (!query) {
    return NextResponse.json(
      { error: "Query param 'query' is required (e.g. query=beach+house)" },
      { status: 400 }
    );
  }

  const validOrientations = ["landscape", "portrait", "squarish"];
  const orientationParam =
    orientation && validOrientations.includes(orientation) ? orientation : null;

  const cacheKey = `images:${query.toLowerCase()}:${count}:${orientationParam ?? "any"}`;
  const cached = imagesCache.get(cacheKey);
  if (cached != null) {
    console.log(`[proxy/images] cache HIT query: "${query}", results: ${(cached as { results: unknown[] }).results?.length ?? 0}`);
    logProxyCall({
      endpoint: "images",
      userId,
      actualCostUsd: 0,
      chargedCredits: 0,
      meta: { query, count, cacheHit: true },
    }).catch(() => {});
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  // Per-user daily free tier check.
  let freeTier: Awaited<ReturnType<typeof checkAndConsumeFreeTier>> | null = null;
  if (userId) {
    const ownerBypass = isProxyOwner(userId);
    freeTier = await checkAndConsumeFreeTier(userId, "images", "unsplash-images", ownerBypass);
    if (!freeTier.isFree) {
      return NextResponse.json(
        {
          error: "daily_limit_reached",
          limit: freeTier.limitToday,
          resetsAt: "midnight UTC",
        },
        { status: 429 }
      );
    }
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey || accessKey === "your_unsplash_access_key_here") {
    return NextResponse.json(
      {
        error:
          "Image search not configured: UNSPLASH_ACCESS_KEY is not set. Add it to .env.local for /api/proxy/images.",
      },
      { status: 503 }
    );
  }

  const url = new URL(UNSPLASH_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(count));
  if (orientationParam) url.searchParams.set("orientation", orientationParam);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });

    // Log a warning if we're running low on rate limit headroom.
    const remaining = res.headers.get("X-Ratelimit-Remaining");
    if (remaining !== null && Number(remaining) < RATELIMIT_WARN_THRESHOLD) {
      console.warn(
        `[proxy/images] ⚠️ Unsplash rate limit low: ${remaining} requests remaining this hour`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[proxy/images] Unsplash error", { status: res.status, body: text });
      return NextResponse.json(
        { error: "Image search failed. Please try again." },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    const data = (await res.json()) as UnsplashSearchResponse;
    const rawResults = data.results ?? [];
    const results: UnsplashPhoto[] = rawResults.map(mapPhoto);

    const responseBody = { results };
    imagesCache.set(cacheKey, responseBody);

    if (freeTier) {
      console.log(
        `[proxy/images] FREE (${freeTier.usedToday}/${freeTier.limitToday} used today) query: "${query}", results: ${results.length}`
      );
    } else {
      console.log(`[proxy/images] query: "${query}", results: ${results.length}`);
    }

    logProxyCall({
      endpoint: "images",
      userId,
      actualCostUsd: 0,
      chargedCredits: 0,
      meta: {
        query,
        count,
        resultCount: results.length,
        cacheHit: false,
        freeTierUsed: freeTier?.usedToday ?? null,
        freeTierLimit: freeTier?.limitToday ?? null,
      },
    }).catch(() => {});

    // Trigger Unsplash download tracking in the background (API guideline requirement).
    const downloadLocations = rawResults
      .map((r) => r.links?.download_location ?? "")
      .filter(Boolean);
    triggerDownloadTracking(downloadLocations, accessKey);

    return NextResponse.json(responseBody, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error("[proxy/images] fetch error:", err);
    return NextResponse.json(
      { error: "Image search service unavailable." },
      { status: 502 }
    );
  }
}
