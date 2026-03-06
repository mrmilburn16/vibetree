/**
 * POST /api/proxy/plant-identify
 * Proxies plant identification to Plant.id API v3.
 * Body: { image: string } where image is base64-encoded.
 * Returns the full Plant.id identification response.
 */

import { NextResponse } from "next/server";

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

    return NextResponse.json(data);
  } catch (e) {
    console.error("[proxy/plant-identify] fetch error:", e);
    return NextResponse.json(
      { error: "Plant identification service unavailable" },
      { status: 502 }
    );
  }
}
