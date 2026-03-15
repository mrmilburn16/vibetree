/**
 * POST /api/proxy/plant-identify
 * Proxies plant identification to Plant.id API v3.
 *
 * Auth: X-App-Token header OR a valid Firebase session (cookie / Bearer token).
 * Billing: credits are deducted from the Firebase-verified user only. If no verified session
 * exists, the body userId may be used for free-tier tracking but not for credit deduction.
 *
 * Body: { image: string, userId?: string } where image is base64-encoded.
 *   userId is now optional; prefer session. Provided only as a tracking hint when no session.
 *
 * Credits per call: read live from the API marketplace registry (proxySlug "plant-identify").
 * Response cached 24h by image hash; max 50 entries (cached responses do NOT charge credits).
 *
 * Credit safety: if Plant.id fails after credits are deducted, credits are refunded automatically.
 */

import { NextResponse } from "next/server";
import { createProxyCache, hashString } from "@/lib/proxyCache";
import { getCreditBalance, deductCredits, addCredits } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";
import { logProxyCall } from "@/lib/proxyCallLog";
import { getProxyCreditsPerCall } from "@/lib/proxyBillingRate";
import { checkAndConsumeFreeTier } from "@/lib/proxyFreeTier";
import { resolveProxyAuth } from "@/lib/proxyAuth";

const PLANT_CACHE_TTL_SECONDS = 86400; // 24 hours
const PLANT_CACHE_MAX_ENTRIES = 50;
const plantCache = createProxyCache({
  ttlSeconds: PLANT_CACHE_TTL_SECONDS,
  maxSize: PLANT_CACHE_MAX_ENTRIES,
});

const PLANTID_BASE = "https://plant.id";
const PLANTID_DETAILS =
  "common_names,watering,best_watering,best_light_condition,best_soil_type,toxicity,description";

/** Plant.id cost to us per call (USD). Matches the registry entry. */
const ACTUAL_COST_USD = 0.08;

function getPlantIdIdentificationUrl(): string {
  const url = new URL("/api/v3/identification", PLANTID_BASE);
  url.searchParams.set("details", PLANTID_DETAILS);
  return url.toString();
}

export async function POST(request: Request) {
  const auth = await resolveProxyAuth(request);
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { image?: unknown; userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // userId for free-tier tracking: verified session preferred, body hint as fallback.
  const bodyUserId = typeof body?.userId === "string" ? (body.userId as string).trim() : "";
  const trackingUserId = auth.verifiedUserId ?? bodyUserId;
  if (!trackingUserId) {
    return NextResponse.json(
      { error: "userId is required for free-tier tracking when no session is present" },
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
  // Plant.id expects raw base64 only; strip data URI prefix if present.
  const dataUriMatch = /^data:[^;]+;base64,/i.exec(image);
  if (dataUriMatch) {
    image = image.slice(dataUriMatch[0].length);
  }

  // Owner bypass only for verified session users — body userId cannot claim owner status.
  const ownerBypass = isProxyOwner(auth.verifiedUserId ?? "");

  // Cache check BEFORE billing — cached hits are always free.
  const cacheKey = `plant:${hashString(image)}`;
  const cached = plantCache.get(cacheKey);
  if (cached != null) {
    console.log("[proxy/plant-identify] cache HIT (no charge)", { key: cacheKey });
    logProxyCall({
      endpoint: "plant-identify",
      userId: trackingUserId,
      actualCostUsd: 0,
      chargedCredits: 0,
      meta: { cacheHit: true },
    }).catch(() => {});
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  // Check free tier — first N identifications/day are free (default 5, configurable from admin).
  const freeTier = await checkAndConsumeFreeTier(
    trackingUserId,
    "plant-identify",
    "plant-id",
    ownerBypass
  );

  let creditsPerCall = 0;
  let creditsBilled = 0;

  if (!freeTier.isFree) {
    // Credits are needed — require a Firebase-verified session.
    if (!auth.verifiedUserId) {
      return NextResponse.json(
        { error: "Session required for credit billing" },
        { status: 401 }
      );
    }

    creditsPerCall = await getProxyCreditsPerCall("plant-identify");

    if (!ownerBypass && creditsPerCall > 0) {
      const balance = await getCreditBalance(auth.verifiedUserId);
      if (balance < creditsPerCall) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditsPerCall },
          { status: 402 }
        );
      }
      const deductResult = await deductCredits(auth.verifiedUserId, creditsPerCall);
      if (!deductResult.ok) {
        return NextResponse.json(
          { error: deductResult.error ?? "Could not deduct credits" },
          { status: 402 }
        );
      }
      creditsBilled = creditsPerCall;
    }
  }

  const apiKey = process.env.PLANTID_API_KEY?.trim();
  if (!apiKey) {
    if (creditsBilled > 0 && auth.verifiedUserId) {
      await addCredits(auth.verifiedUserId, creditsBilled).catch(() => {});
    }
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
      // Plant.id rejected the request — refund credits.
      if (creditsBilled > 0 && auth.verifiedUserId) {
        await addCredits(auth.verifiedUserId, creditsBilled).catch((refundErr) => {
          console.error("[proxy/plant-identify] credit refund failed", {
            userId: auth.verifiedUserId,
            amount: creditsBilled,
            error: refundErr,
          });
        });
      }
      const message =
        (data as { message?: string })?.message ??
        (data as { error?: string })?.error ??
        "Plant identification failed";
      const status = res.status === 401 ? 502 : res.status >= 500 ? 502 : res.status;
      return NextResponse.json({ error: message }, { status });
    }

    plantCache.set(cacheKey, data);

    if (freeTier.isFree) {
      console.log(
        `[proxy/plant-identify] FREE (${freeTier.usedToday}/${freeTier.limitToday} used today)`,
        { key: cacheKey }
      );
    } else {
      console.log(
        `[proxy/plant-identify] CHARGED ${ownerBypass ? 0 : creditsPerCall} credits (free limit exceeded: ${freeTier.usedToday}/${freeTier.limitToday} used today)`,
        { key: cacheKey }
      );
    }

    logProxyCall({
      endpoint: "plant-identify",
      userId: trackingUserId,
      actualCostUsd: ACTUAL_COST_USD,
      chargedCredits: freeTier.isFree || ownerBypass ? 0 : creditsPerCall,
      meta: {
        cacheHit: false,
        ownerBypass,
        freeTier: freeTier.isFree,
        freeTierUsed: freeTier.usedToday,
        freeTierLimit: freeTier.limitToday,
      },
    }).catch(() => {});

    return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });
  } catch (e) {
    console.error("[proxy/plant-identify] fetch error:", e);
    // Unexpected network failure — refund credits.
    if (creditsBilled > 0 && auth.verifiedUserId) {
      await addCredits(auth.verifiedUserId, creditsBilled).catch((refundErr) => {
        console.error("[proxy/plant-identify] credit refund failed", {
          userId: auth.verifiedUserId,
          amount: creditsBilled,
          error: refundErr,
        });
      });
    }
    return NextResponse.json(
      { error: "Plant identification service unavailable" },
      { status: 502 }
    );
  }
}
