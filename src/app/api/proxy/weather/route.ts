/**
 * GET /api/proxy/weather
 * Proxies OpenWeatherMap current weather or forecast.
 * Auth: valid user session (cookie/Bearer) OR X-App-Token header matching VIBETREE_APP_TOKEN.
 * Query params: lat & lon (current location) OR city (city search); type = "current" | "forecast"; debug = true to return raw OpenWeather API response (dev only).
 * Rate limit: per-user daily limit (Firestore) when session present; 100/day in-memory for app-token-only. Returns 429 if exceeded.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createProxyCache } from "@/lib/proxyCache";
import { getApiMarketplaceEntryBySlug } from "@/lib/apiMarketplace";
import {
  getDailyUsage,
  incrementDailyUsage,
  getTodayDateKey,
} from "@/lib/apiUsageFirestore";

const WEATHER_CACHE_TTL_SECONDS = 600; // 10 minutes
const weatherCache = createProxyCache({ ttlSeconds: WEATHER_CACHE_TTL_SECONDS });
// Geocoding results are cached with the same TTL so a weather-cache miss doesn't
// trigger a redundant reverse-geocode call for coordinates fetched recently.
const geoCache = createProxyCache({ ttlSeconds: WEATHER_CACHE_TTL_SECONDS });

const OPENWEATHER_WEATHER = "https://api.openweathermap.org/data/2.5/weather";
const OPENWEATHER_FORECAST = "https://api.openweathermap.org/data/2.5/forecast";
const OPENWEATHER_GEO_REVERSE = "http://api.openweathermap.org/geo/1.0/reverse";
/** In-memory limit for app-token-only requests (no userId for Firestore). */
const RATE_LIMIT_MAX_APP_TOKEN = 100;

const WEATHER_API_ID = "openweathermap";

function normalizeToken(s: string | undefined): string {
  return (s ?? "").replace(/\r\n?|\n/g, "").trim();
}

// In-memory: key = `${rateLimitKey}:${YYYY-MM-DD}` -> count (used only for app-token when no userId)
const rateLimitMap = new Map<string, number>();

function getDateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function getCountInMemory(rateLimitKey: string): number {
  const key = `${rateLimitKey}:${getDateKey()}`;
  return rateLimitMap.get(key) ?? 0;
}

function incrementCountInMemory(rateLimitKey: string): void {
  const key = `${rateLimitKey}:${getDateKey()}`;
  rateLimitMap.set(key, (rateLimitMap.get(key) ?? 0) + 1);
}

/** Resolve auth: session user or app token. Returns { rateLimitKey, userId? } or null if unauthorized. */
async function resolveAuth(request: Request): Promise<{ rateLimitKey: string; userId?: string } | null> {
  const user = await getSession(request);
  if (user) return { rateLimitKey: user.uid, userId: user.uid };

  const appToken = process.env.VIBETREE_APP_TOKEN && normalizeToken(process.env.VIBETREE_APP_TOKEN);
  const headerToken = normalizeToken(request.headers.get("x-app-token") ?? request.headers.get("X-App-Token") ?? "");
  const match = Boolean(appToken && headerToken && headerToken === appToken);
  if (!match && (headerToken || appToken)) {
    console.warn(
      "[proxy/weather] X-App-Token mismatch — header first 4:",
      headerToken ? `"${headerToken.slice(0, 4)}"` : "(empty)",
      "env first 4:",
      appToken ? `"${appToken.slice(0, 4)}"` : "(empty)"
    );
  }
  if (match) return { rateLimitKey: "app" };
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const city = searchParams.get("city")?.trim();
  const type = searchParams.get("type") ?? "current";
  const debug = searchParams.get("debug") === "true";
  const auth = await resolveAuth(request);
  console.log("🌤️ WEATHER REQUEST", {
    auth: auth ? { rateLimitKey: auth.rateLimitKey } : null,
    params: { lat, lon, city, type },
  });
  if (!auth) {
    const headerToken = normalizeToken(request.headers.get("x-app-token") ?? request.headers.get("X-App-Token") ?? "");
    const envToken = process.env.VIBETREE_APP_TOKEN && normalizeToken(process.env.VIBETREE_APP_TOKEN);
    console.warn(
      "[proxy/weather] 401 Unauthorized — X-App-Token header first 4:",
      headerToken ? `"${headerToken.slice(0, 4)}"` : "(missing)",
      "VIBETREE_APP_TOKEN env first 4:",
      envToken ? `"${envToken.slice(0, 4)}"` : "(not set)"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const marketplaceEntry = getApiMarketplaceEntryBySlug("weather");
  const dailyFreeLimit = marketplaceEntry?.dailyFreeLimit;
  const dateKey = getTodayDateKey();

  if (auth.userId != null && typeof dailyFreeLimit === "number") {
    const count = await getDailyUsage(auth.userId, dateKey, WEATHER_API_ID);
    if (count >= dailyFreeLimit) {
      return NextResponse.json(
        {
          error: "daily_limit_reached",
          limit: dailyFreeLimit,
          resetsAt: "midnight UTC",
        },
        { status: 429 }
      );
    }
    await incrementDailyUsage(auth.userId, dateKey, WEATHER_API_ID);
  } else {
    if (getCountInMemory(auth.rateLimitKey) >= RATE_LIMIT_MAX_APP_TOKEN) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 100 weather requests per day." },
        { status: 429 }
      );
    }
    incrementCountInMemory(auth.rateLimitKey);
  }

  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Weather service not configured" },
      { status: 503 }
    );
  }

  const hasLatLon =
    lat != null &&
    lon != null &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lon));
  const hasCity = typeof city === "string" && city.length > 0;

  if (!hasLatLon && !hasCity) {
    return NextResponse.json(
      { error: "Query must include lat & lon or city" },
      { status: 400 }
    );
  }

  const cacheKey =
    hasCity
      ? `weather:${type}:${encodeURIComponent(city)}`
      : `weather:${type}:${lat},${lon}`;
  if (!debug) {
    const cached = weatherCache.get(cacheKey);
    if (cached != null) {
      console.log("[proxy/weather] cache HIT", { key: cacheKey });
      if (!auth.userId) incrementCountInMemory(auth.rateLimitKey);
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }
  }

  const base =
    type === "forecast" ? OPENWEATHER_FORECAST : OPENWEATHER_WEATHER;
  // Imperial = Fahrenheit and mph so the app doesn't need to convert from Kelvin.
  const units = "&units=imperial";
  let weatherUrl: string;
  if (hasCity) {
    weatherUrl = `${base}?q=${encodeURIComponent(city)}&appid=${apiKey}${units}`;
  } else {
    weatherUrl = `${base}?lat=${lat}&lon=${lon}&appid=${apiKey}${units}`;
  }

  // For lat/lon requests, resolve a city name from the reverse geocoding API.
  // City-name searches already carry an explicit name; no need to geocode those.
  const geoCacheKey = hasLatLon ? `geo:${lat},${lon}` : null;
  const cachedGeoName: string | null = geoCacheKey
    ? ((geoCache.get(geoCacheKey) as { name?: string } | null)?.name ?? null)
    : null;
  const geoFetchUrl =
    hasLatLon && cachedGeoName === null
      ? `${OPENWEATHER_GEO_REVERSE}?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`
      : null;

  try {
    // Fetch weather and (if needed) geocoding in parallel.
    const [res, geoRes] = await Promise.all([
      fetch(weatherUrl),
      geoFetchUrl ? fetch(geoFetchUrl) : Promise.resolve(null),
    ]);

    const data = await res.json().catch(() => ({}));

    if (debug) {
      if (!auth.userId) incrementCountInMemory(auth.rateLimitKey);
      return NextResponse.json(data, { status: res.status });
    }

    if (!res.ok) {
      const message =
        (data as { message?: string })?.message ?? "Weather API error";
      return NextResponse.json(
        { error: message },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    // Resolve the best city name: prefer reverse geocoding over OWM's own field.
    let resolvedCityName: string | null = cachedGeoName;
    if (geoRes && geoCacheKey) {
      try {
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const geoName: string | undefined = Array.isArray(geoData) && geoData.length > 0
            ? geoData[0]?.name
            : undefined;
          if (geoName) {
            resolvedCityName = geoName;
            geoCache.set(geoCacheKey, { name: geoName });
            console.log("[proxy/weather] geo resolved", { lat, lon, name: geoName });
          }
        }
      } catch {
        // Non-fatal: fall back to OWM's own name field.
      }
    }

    // Patch the response with the resolved city name.
    if (resolvedCityName) {
      if (type === "forecast" && data && typeof data === "object" && data.city) {
        (data as Record<string, unknown>).city = {
          ...(data.city as object),
          name: resolvedCityName,
        };
      } else if (data && typeof data === "object") {
        (data as Record<string, unknown>).name = resolvedCityName;
      }
    }

    weatherCache.set(cacheKey, data);
    console.log("[proxy/weather] cache MISS → stored", { key: cacheKey });
    if (!auth.userId) incrementCountInMemory(auth.rateLimitKey);
    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (e) {
    console.error("[proxy/weather] fetch error:", e);
    return NextResponse.json(
      { error: "Weather service unavailable" },
      { status: 502 }
    );
  }
}
