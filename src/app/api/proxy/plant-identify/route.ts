/**
 * POST /api/proxy/plant-identify
 * Proxies plant identification to Plant.id API v3.
 * Body: { image: string } where image is base64-encoded.
 * Returns the full Plant.id identification response.
 * Response cached 24h by image hash; max 50 entries.
 */

import { NextResponse } from "next/server";
import { createProxyCache, hashString } from "@/lib/proxyCache";

const PLANT_CACHE_TTL_SECONDS = 86400; // 24 hours
const PLANT_CACHE_MAX_ENTRIES = 50;
const plantCache = createProxyCache({
  ttlSeconds: PLANT_CACHE_TTL_SECONDS,
  maxSize: PLANT_CACHE_MAX_ENTRIES,
});

const PLANTID_BASE = "https://plant.id";
const PLANTID_DETAILS =
  "common_names,watering,best_watering,best_light_condition,best_soil_type,toxicity,description";

function getPlantIdIdentificationUrl(): string {
  const url = new URL("/api/v3/identification", PLANTID_BASE);
  url.searchParams.set("details", PLANTID_DETAILS);
  return url.toString();
}

export async function POST(request: Request) {
  let body: { image?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  let image = typeof body?.image === "string" ? body.image.trim() : "";
  if (!image) {
    return NextResponse.json(
      { error: "Body must include image (base64 string)" },
      { status: 400 }
    );
  }
  // Plant.id expects raw base64 only; strip data URI prefix if present
  const dataUriMatch = /^data:[^;]+;base64,/i.exec(image);
  if (dataUriMatch) {
    image = image.slice(dataUriMatch[0].length);
  }

  const cacheKey = `plant:${hashString(image)}`;
  const cached = plantCache.get(cacheKey);
  if (cached != null) {
    console.log("[proxy/plant-identify] cache HIT", { key: cacheKey });
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const apiKey = process.env.PLANTID_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Plant identification service not configured" },
      { status: 503 }
    );
  }

  const requestBody = { images: [image] };

  const plantIdUrl = getPlantIdIdentificationUrl();
  console.log("[proxy/plant-identify] full URL:", plantIdUrl);
  console.log("[proxy/plant-identify] request body to Plant.id:", {
    images: [`<base64, ${image.length} chars>`],
  });

  try {
    const res = await fetch(plantIdUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.warn("[proxy/plant-identify] Plant.id error", { status: res.status, body: data });
      const message =
        (data as { message?: string })?.message ??
        (data as { error?: string })?.error ??
        "Plant identification failed";
      const status =
        res.status === 401 ? 502 : res.status >= 500 ? 502 : res.status;
      return NextResponse.json(
        { error: message },
        { status }
      );
    }

    plantCache.set(cacheKey, data);
    console.log("[proxy/plant-identify] cache MISS → stored", { key: cacheKey });
    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (e) {
    console.error("[proxy/plant-identify] fetch error:", e);
    return NextResponse.json(
      { error: "Plant identification service unavailable" },
      { status: 502 }
    );
  }
}
