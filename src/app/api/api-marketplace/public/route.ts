import { NextResponse } from "next/server";
import { getApiMarketplaceEntries } from "@/lib/apiMarketplace";

export const dynamic = "force-dynamic";

/**
 * GET /api/api-marketplace/public
 * Returns enabled API marketplace entries for the public pricing page.
 * No auth required. Only enabled entries; excludes internal cost/markup.
 */
export async function GET() {
  const all = getApiMarketplaceEntries();
  const entries = all
    .filter((e) => e.enabled)
    .map(({ id, proxySlug, name, category, userPricePerCallUsd, costPerCallUsd, note }) => ({
      id,
      proxySlug,
      name,
      category,
      userPricePerCallUsd,
      costPerCallUsd,
      note,
    }));
  return NextResponse.json({ entries });
}
