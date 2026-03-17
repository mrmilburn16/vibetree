/**
 * Firestore persistence for RevenueCat setup result per user.
 * Collection: revenuecat_configs. Document ID: Firebase Auth uid.
 * Only stores the setup result (public key, IDs); never the user's RC secret key.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "revenuecat_configs";

export interface RevenueCatConfig {
  projectId: string;
  appId: string;
  publicApiKey: string;
  entitlementId: string;
  offeringId: string;
  products: Array<{
    productId: string;
    storeIdentifier: string;
    displayName: string;
    lookupKey: string;
  }>;
  bundleId: string;
  createdAt: number;
  updatedAt: number;
}

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

export async function saveRevenueCatConfig(
  userId: string,
  config: RevenueCatConfig
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Firestore not available");
  const now = Date.now();
  const doc = {
    ...config,
    createdAt: config.createdAt ?? now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).doc(userId).set(doc);
}

export async function getRevenueCatConfig(
  userId: string
): Promise<RevenueCatConfig | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    const products = Array.isArray(data.products)
      ? (data.products as Array<{
          productId: string;
          storeIdentifier: string;
          displayName: string;
          lookupKey: string;
        }>)
      : [];
    return {
      projectId: String(data.projectId ?? ""),
      appId: String(data.appId ?? ""),
      publicApiKey: String(data.publicApiKey ?? ""),
      entitlementId: String(data.entitlementId ?? ""),
      offeringId: String(data.offeringId ?? ""),
      products,
      bundleId: String(data.bundleId ?? ""),
      createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function deleteRevenueCatConfig(
  userId: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.collection(COLLECTION).doc(userId).delete();
}
