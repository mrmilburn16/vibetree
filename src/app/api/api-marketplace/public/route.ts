import { NextResponse } from "next/server";
import { mergeWithOverrides } from "@/lib/apiMarketplace";
import { getAllMarketplaceOverrides } from "@/lib/apiMarketplaceFirestore";

export const dynamic = "force-dynamic";

/**
 * GET /api/api-marketplace/public
 * Returns enabled API marketplace entries for the public pricing page.
 * No auth required. Only enabled entries; excludes internal cost/markup.
 * Reads live Firestore overrides so price edits from /admin/api-costs are reflected immediately.
 */
export async function GET() {
  const overrides = await getAllMarketplaceOverrides();
  const all = mergeWithOverrides(overrides);
  const entries = all
    .filter((e) => e.enabled)
    .map(({ id, proxySlug, name, category, userPricePerCallUsd, costPerCallUsd, note, dailyFreeLimit }) => ({
      id,
      proxySlug,
      name,
      category,
      userPricePerCallUsd,
      costPerCallUsd,
      note,
      ...(dailyFreeLimit != null && { dailyFreeLimit }),
    }));
  return NextResponse.json({ entries });
}
