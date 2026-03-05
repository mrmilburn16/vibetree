/**
 * GET /api/proxy/weather
 * Proxies OpenWeatherMap current weather or forecast.
 * Auth: valid user session (cookie/Bearer) OR X-App-Token header matching VIBETREE_APP_TOKEN.
 * Query params: lat & lon (current location) OR city (city search); type = "current" | "forecast"; debug = true to return raw OpenWeather API response (dev only).
 * Optional: debug=true — returns the full raw OpenWeather API response as JSON (for development).
 * Rate limit: 100 calls per user (or per app-token) per calendar day. Returns 429 if exceeded.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const OPENWEATHER_WEATHER = "https://api.openweathermap.org/data/2.5/weather";
const OPENWEATHER_FORECAST = "https://api.openweathermap.org/data/2.5/forecast";
const RATE_LIMIT_MAX = 100;

function normalizeToken(s: string | undefined): string {
  return (s ?? "").replace(/\r\n?|\n/g, "").trim();
}

// In-memory: key = `${userId}:${YYYY-MM-DD}` -> count for that calendar day
const rateLimitMap = new Map<string, number>();

function getDateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function getCount(rateLimitKey: string): number {
  const key = `${rateLimitKey}:${getDateKey()}`;
  return rateLimitMap.get(key) ?? 0;
}

function incrementCount(rateLimitKey: string): void {
  const key = `${rateLimitKey}:${getDateKey()}`;
  rateLimitMap.set(key, (rateLimitMap.get(key) ?? 0) + 1);
}

/** Resolve auth: session user or app token. Returns { rateLimitKey } or null if unauthorized. */
async function resolveAuth(request: Request): Promise<{ rateLimitKey: string } | null> {
  const user = await getSession(request);
  if (user) return { rateLimitKey: user.uid };

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

  if (getCount(auth.rateLimitKey) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 100 weather requests per day." },
      { status: 429 }
    );
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

  const base =
    type === "forecast" ? OPENWEATHER_FORECAST : OPENWEATHER_WEATHER;
  // Imperial = Fahrenheit and mph so the app doesn't need to convert from Kelvin.
  const units = "&units=imperial";
  let url: string;
  if (hasCity) {
    url = `${base}?q=${encodeURIComponent(city)}&appid=${apiKey}${units}`;
  } else {
    url = `${base}?lat=${lat}&lon=${lon}&appid=${apiKey}${units}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));

    if (debug) {
      incrementCount(auth.rateLimitKey);
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

    incrementCount(auth.rateLimitKey);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[proxy/weather] fetch error:", e);
    return NextResponse.json(
      { error: "Weather service unavailable" },
      { status: 502 }
    );
  }
}
