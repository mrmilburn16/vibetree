/**
 * GET /api/proxy/places
 * Proxies Apple MapKit Server API to search for nearby places.
 * Query params: lat, lng, radius (meters, default 5000), category or query (any search term).
 * `query` and `category` are aliases — either works. The value is passed directly to Apple MapKit.
 * Rate limit: 100 requests per hour per IP. Returns 429 if exceeded.
 * Response cached 1 hour by lat/lng/radius/searchTerm.
 */

import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";
import { getClientIp } from "@/lib/adminAuth";
import { createProxyCache } from "@/lib/proxyCache";
import { logProxyCall } from "@/lib/proxyCallLog";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";
import { checkAndConsumeFreeTier } from "@/lib/proxyFreeTier";

const PLACES_CACHE_TTL_SECONDS = 3600; // 1 hour
const placesCache = createProxyCache({ ttlSeconds: PLACES_CACHE_TTL_SECONDS });

const APPLE_MAPS_TOKEN_URL = "https://maps-api.apple.com/v1/token";
const APPLE_MAPS_SEARCH_URL = "https://maps-api.apple.com/v1/search";

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type RateLimitEntry = { timestamps: number[] };

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIpKey(request: Request): string {
  return getClientIp(request) ?? "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  let entry = rateLimitMap.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitMap.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  return entry.timestamps.length >= RATE_LIMIT_MAX;
}

function recordRequest(key: string): void {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitMap.set(key, entry);
  }
  entry.timestamps.push(now);
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

function createAppleMapsJwt(): string {
  const teamId = process.env.APPLE_MAPS_TEAM_ID?.trim();
  const keyId = process.env.APPLE_MAPS_KEY_ID?.trim();
  const privateKey = process.env.APPLE_MAPS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!teamId || !keyId || !privateKey) {
    throw new Error("Apple Maps credentials not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 30 * 60; // 30 minutes

  return jwt.sign(
    { iss: teamId, iat: now, exp },
    privateKey,
    { algorithm: "ES256", keyid: keyId }
  );
}

async function getMapsAccessToken(): Promise<string> {
  const mapsAuthToken = createAppleMapsJwt();
  const res = await fetch(APPLE_MAPS_TOKEN_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${mapsAuthToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apple Maps token failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) {
    throw new Error("Apple Maps token response missing accessToken");
  }
  return data.accessToken;
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface AppleSearchResult {
  name?: string;
  formattedAddressLines?: string[];
  coordinate?: { latitude?: number; longitude?: number };
}

interface AppleSearchResponse {
  results?: AppleSearchResult[];
}

export async function GET(request: Request) {
  const ipKey = getClientIpKey(request);

  if (isRateLimited(ipKey)) {
    return NextResponse.json(
      { error: "Too many requests. Limit is 100 per hour per IP." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");
  const searchTerm = (
    searchParams.get("query") ?? searchParams.get("category") ?? ""
  ).trim();
  // Optional userId — generated apps append &userId=kUserId to enable per-user Firestore tracking.
  const userId = (searchParams.get("userId") ?? "").trim();

  const lat = latParam != null ? Number(latParam) : NaN;
  const lng = lngParam != null ? Number(lngParam) : NaN;
  const radius = radiusParam != null ? Math.max(0, Number(radiusParam)) : 5000;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "Query params lat and lng are required and must be numbers." },
      { status: 400 }
    );
  }

  if (!searchTerm) {
    return NextResponse.json(
      { error: "Query param 'query' or 'category' is required (e.g. category=tacos)." },
      { status: 400 }
    );
  }

  const cacheKey = `places:${lat.toFixed(3)},${lng.toFixed(3)}:${radius}:${searchTerm.toLowerCase()}`;
  const cached = placesCache.get(cacheKey);
  if (cached != null) {
    console.log("[proxy/places] cache HIT", { key: cacheKey });
    recordRequest(ipKey);
    logProxyCall({ endpoint: "places", userId, actualCostUsd: 0, chargedCredits: 0, meta: { cacheHit: true } }).catch(() => {});
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // Per-user free tier check (only when userId is provided by the generated app).
  let freeTier: Awaited<ReturnType<typeof checkAndConsumeFreeTier>> | null = null;
  if (userId) {
    const ownerBypass = isProxyOwner(userId);
    freeTier = await checkAndConsumeFreeTier(userId, "places", "apple-mapkit", ownerBypass);
    if (!freeTier.isFree) {
      // Places is free to us (Apple MapKit free tier), so we hard-cap rather than bill credits.
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

  try {
    const accessToken = await getMapsAccessToken();
    const appleParams = new URLSearchParams({ q: searchTerm });
    appleParams.set("searchLocation", `${lat},${lng}`);
    const searchUrl = `${APPLE_MAPS_SEARCH_URL}?${appleParams.toString()}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      const text = await searchRes.text();
      console.error("[proxy/places] Apple search failed:", searchRes.status, text);
      return NextResponse.json(
        { error: "Places search failed." },
        { status: searchRes.status >= 500 ? 502 : searchRes.status }
      );
    }

    const searchData = (await searchRes.json()) as AppleSearchResponse;
    const rawResults = searchData.results ?? [];

    const places = rawResults
      .map((r) => {
        const placeLat = r.coordinate?.latitude;
        const placeLng = r.coordinate?.longitude;
        if (placeLat == null || placeLng == null) return null;
        const distance = haversineDistanceMeters(lat, lng, placeLat, placeLng);
        if (distance > radius) return null;
        const address = (r.formattedAddressLines ?? []).join(", ");
        return {
          name: r.name ?? "",
          address,
          lat: placeLat,
          lng: placeLng,
          category: searchTerm,
          distance: Math.round(distance),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => a.distance - b.distance);

    const responseBody = { results: places };
    placesCache.set(cacheKey, responseBody);
    if (freeTier) {
      console.log(
        `[proxy/places] FREE (${freeTier.usedToday}/${freeTier.limitToday} used today)`,
        { key: cacheKey, resultCount: places.length }
      );
    } else {
      console.log("[proxy/places] cache MISS → stored (no userId, IP-limited)", { key: cacheKey });
    }
    recordRequest(ipKey);
    logProxyCall({
      endpoint: "places",
      userId,
      actualCostUsd: 0,
      chargedCredits: 0,
      meta: {
        cacheHit: false,
        resultCount: places.length,
        freeTier: freeTier?.isFree ?? null,
        freeTierUsed: freeTier?.usedToday ?? null,
        freeTierLimit: freeTier?.limitToday ?? null,
      },
    }).catch(() => {});
    return NextResponse.json(responseBody, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Places service error";
    if (message.includes("not configured")) {
      return NextResponse.json({ error: "Places service not configured." }, { status: 503 });
    }
    console.error("[proxy/places]", err);
    return NextResponse.json({ error: "Places service unavailable." }, { status: 502 });
  }
}
