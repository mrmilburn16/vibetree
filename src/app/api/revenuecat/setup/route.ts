import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setupRevenueCat, type SetupRevenueCatError } from "@/lib/revenuecat";
import {
  saveRevenueCatConfig,
  type RevenueCatConfig,
} from "@/lib/revenuecatFirestore";

/** POST body for RevenueCat automated setup */
interface SetupBody {
  rcSecretKey: string;
  projectName: string;
  appName: string;
  bundleId: string;
  products: Array<{
    storeIdentifier: string;
    displayName: string;
    lookupKey: string;
    position: number;
  }>;
}

function validateBody(body: unknown): { ok: true; data: SetupBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const rcSecretKey = typeof b.rcSecretKey === "string" ? b.rcSecretKey.trim() : "";
  const projectName = typeof b.projectName === "string" ? b.projectName.trim() : "";
  const appName = typeof b.appName === "string" ? b.appName.trim() : "";
  const bundleId = typeof b.bundleId === "string" ? b.bundleId.trim() : "";
  if (!rcSecretKey) return { ok: false, error: "rcSecretKey is required." };
  if (!projectName) return { ok: false, error: "projectName is required." };
  if (!appName) return { ok: false, error: "appName is required." };
  if (!bundleId) return { ok: false, error: "bundleId is required." };
  const rawProducts = b.products;
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
    return { ok: false, error: "products must be a non-empty array." };
  }
  const products: SetupBody["products"] = [];
  for (let i = 0; i < rawProducts.length; i++) {
    const p = rawProducts[i];
    if (!p || typeof p !== "object") {
      return { ok: false, error: `products[${i}] must be an object.` };
    }
    const po = p as Record<string, unknown>;
    const storeIdentifier =
      typeof po.storeIdentifier === "string" ? po.storeIdentifier.trim() : "";
    const displayName =
      typeof po.displayName === "string" ? po.displayName.trim() : "";
    const lookupKey =
      typeof po.lookupKey === "string" ? po.lookupKey.trim() : "";
    const position = typeof po.position === "number" ? po.position : i;
    if (!storeIdentifier || !displayName || !lookupKey) {
      return {
        ok: false,
        error: `products[${i}] must have storeIdentifier, displayName, and lookupKey.`,
      };
    }
    products.push({
      storeIdentifier,
      displayName,
      lookupKey,
      position,
    });
  }
  return {
    ok: true,
    data: {
      rcSecretKey,
      projectName,
      appName,
      bundleId,
      products,
    },
  };
}

/**
 * POST /api/revenuecat/setup
 * Session-only auth. Runs RevenueCat automated setup and persists config.
 */
export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const validated = validateBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { data } = validated;

  try {
    const result = await setupRevenueCat({
      secretKey: data.rcSecretKey,
      projectName: data.projectName,
      appName: data.appName,
      bundleId: data.bundleId,
      products: data.products.map((p) => ({
        storeIdentifier: p.storeIdentifier,
        displayName: p.displayName,
        lookupKey: p.lookupKey,
        position: p.position,
      })),
    });

    const config: RevenueCatConfig = {
      projectId: result.projectId,
      appId: result.appId,
      publicApiKey: result.publicApiKey,
      entitlementId: result.entitlementId,
      offeringId: result.offeringId,
      products: data.products.map((p, i) => ({
        productId: result.productIds[i] ?? "",
        storeIdentifier: p.storeIdentifier,
        displayName: p.displayName,
        lookupKey: p.lookupKey,
      })),
      bundleId: data.bundleId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveRevenueCatConfig(user.uid, config);

    return NextResponse.json({
      success: true,
      publicApiKey: result.publicApiKey,
      projectId: result.projectId,
      appId: result.appId,
      entitlementId: result.entitlementId,
      offeringId: result.offeringId,
      productIds: result.productIds,
      packageIds: result.packageIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed.";
    const step = (err as SetupRevenueCatError).step ?? "setup";
    console.error("🏪 RC setup failed:", { step, message, userId: user.uid });
    return NextResponse.json(
      { error: message, step },
      { status: 500 }
    );
  }
}
