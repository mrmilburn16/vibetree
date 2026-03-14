import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { mergeWithOverrides } from "@/lib/apiMarketplace";
import {
  getAllMarketplaceOverrides,
  setMarketplaceOverride,
} from "@/lib/apiMarketplaceFirestore";
import { invalidateProxyBillingCache } from "@/lib/proxyBillingRate";

export const dynamic = "force-dynamic";

/** GET: list all API marketplace entries with live Firestore overrides applied. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const overrides = await getAllMarketplaceOverrides();
  const entries = mergeWithOverrides(overrides);
  return NextResponse.json({ entries });
}

/**
 * PATCH: update one or more fields for an entry (admin only).
 * Body: { id: string, enabled?: boolean, userPricePerCallUsd?: number | null }
 * At least one of enabled or userPricePerCallUsd must be provided.
 */
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json(
      { error: "Body must include id (string)" },
      { status: 400 }
    );
  }

  const fields: { enabled?: boolean; userPricePerCallUsd?: number | null; costPerCallUsd?: number | null; dailyFreeLimit?: number | null } = {};

  if (typeof body.enabled === "boolean") {
    fields.enabled = body.enabled;
  }

  if (body.userPricePerCallUsd !== undefined) {
    if (body.userPricePerCallUsd === null) {
      fields.userPricePerCallUsd = null;
    } else if (
      typeof body.userPricePerCallUsd === "number" &&
      Number.isFinite(body.userPricePerCallUsd) &&
      body.userPricePerCallUsd >= 0
    ) {
      fields.userPricePerCallUsd = body.userPricePerCallUsd;
    } else {
      return NextResponse.json(
        { error: "userPricePerCallUsd must be a non-negative number or null" },
        { status: 400 }
      );
    }
  }

  if (body.costPerCallUsd !== undefined) {
    if (body.costPerCallUsd === null) {
      fields.costPerCallUsd = null;
    } else if (
      typeof body.costPerCallUsd === "number" &&
      Number.isFinite(body.costPerCallUsd) &&
      body.costPerCallUsd >= 0
    ) {
      fields.costPerCallUsd = body.costPerCallUsd;
    } else {
      return NextResponse.json(
        { error: "costPerCallUsd must be a non-negative number or null" },
        { status: 400 }
      );
    }
  }

  if (body.dailyFreeLimit !== undefined) {
    if (body.dailyFreeLimit === null) {
      fields.dailyFreeLimit = null;
    } else if (
      typeof body.dailyFreeLimit === "number" &&
      Number.isFinite(body.dailyFreeLimit) &&
      Number.isInteger(body.dailyFreeLimit) &&
      body.dailyFreeLimit >= 0
    ) {
      fields.dailyFreeLimit = body.dailyFreeLimit;
    } else {
      return NextResponse.json(
        { error: "dailyFreeLimit must be a non-negative integer or null" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { error: "Body must include at least one of: enabled, userPricePerCallUsd, costPerCallUsd, dailyFreeLimit" },
      { status: 400 }
    );
  }

  await setMarketplaceOverride(id, fields);
  // Immediately clear the proxy billing cache so the new price is used on the
  // very next proxy call rather than waiting for the 60-second TTL to expire.
  invalidateProxyBillingCache();

  // Return the updated full entry list so the client can refresh in one round-trip
  const overrides = await getAllMarketplaceOverrides();
  const entries = mergeWithOverrides(overrides);
  const updated = entries.find((e) => e.id === id);
  return NextResponse.json({ ok: true, entry: updated, entries });
}
