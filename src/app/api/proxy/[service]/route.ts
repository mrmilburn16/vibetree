/**
 * Dynamic proxy scaffold: /api/proxy/[service]
 * Generated apps call this with the service slug (e.g. finnhub, google-maps).
 * We look up the service in the API marketplace registry; if enabled, we would
 * make the real API call with our stored key and log usage for billing.
 * For now we return a placeholder response — API keys are not wired.
 */

import { NextResponse } from "next/server";
import { getApiMarketplaceEntryBySlug } from "@/lib/apiMarketplace";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ service: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { service } = await context.params;
  const entry = getApiMarketplaceEntryBySlug(service);
  if (!entry) {
    return NextResponse.json(
      { error: "Unknown proxy service", service },
      { status: 404 }
    );
  }
  if (!entry.enabled) {
    return NextResponse.json(
      { error: "Proxy service is disabled", service: entry.proxySlug },
      { status: 503 }
    );
  }
  return NextResponse.json({
    scaffold: true,
    service: entry.proxySlug,
    name: entry.name,
    message: "Proxy not yet implemented; API key not wired.",
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { service } = await context.params;
  const entry = getApiMarketplaceEntryBySlug(service);
  if (!entry) {
    return NextResponse.json(
      { error: "Unknown proxy service", service },
      { status: 404 }
    );
  }
  if (!entry.enabled) {
    return NextResponse.json(
      { error: "Proxy service is disabled", service: entry.proxySlug },
      { status: 503 }
    );
  }
  return NextResponse.json({
    scaffold: true,
    service: entry.proxySlug,
    name: entry.name,
    message: "Proxy not yet implemented; API key not wired.",
  });
}
