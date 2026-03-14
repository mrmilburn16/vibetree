/**
 * Firestore persistence for API Marketplace overrides.
 * Collection: api_marketplace
 * One document per entry ID (e.g. "plant-id", "openweathermap").
 * Fields stored are only the overridable fields: enabled, userPricePerCallUsd.
 * The canonical defaults live in apiMarketplace.ts; Firestore stores deltas.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "api_marketplace";

export type MarketplaceOverride = {
  enabled?: boolean;
  userPricePerCallUsd?: number | null;
  costPerCallUsd?: number | null;
  dailyFreeLimit?: number | null;
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

/**
 * Read all persisted overrides from Firestore.
 * Returns a map of { [entryId]: override }.
 */
export async function getAllMarketplaceOverrides(): Promise<
  Record<string, MarketplaceOverride>
> {
  const db = getDb();
  if (!db) return {};
  try {
    const snap = await db.collection(COLLECTION).get();
    const result: Record<string, MarketplaceOverride> = {};
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const override: MarketplaceOverride = {};
      if (typeof data.enabled === "boolean") override.enabled = data.enabled;
      if (data.userPricePerCallUsd !== undefined) {
        override.userPricePerCallUsd =
          typeof data.userPricePerCallUsd === "number"
            ? data.userPricePerCallUsd
            : null;
      }
      if (data.costPerCallUsd !== undefined) {
        override.costPerCallUsd =
          typeof data.costPerCallUsd === "number" ? data.costPerCallUsd : null;
      }
      if (data.dailyFreeLimit !== undefined) {
        override.dailyFreeLimit =
          typeof data.dailyFreeLimit === "number" && Number.isInteger(data.dailyFreeLimit) && data.dailyFreeLimit >= 0
            ? data.dailyFreeLimit
            : null;
      }
      result[doc.id] = override;
    });
    return result;
  } catch (err) {
    console.error("[apiMarketplaceFirestore] Failed to read overrides:", err);
    return {};
  }
}

/**
 * Write (merge) one or more override fields for a given entry ID.
 */
export async function setMarketplaceOverride(
  id: string,
  fields: MarketplaceOverride
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (fields.enabled !== undefined) update.enabled = fields.enabled;
    if (fields.userPricePerCallUsd !== undefined)
      update.userPricePerCallUsd = fields.userPricePerCallUsd;
    if (fields.costPerCallUsd !== undefined)
      update.costPerCallUsd = fields.costPerCallUsd;
    if (fields.dailyFreeLimit !== undefined)
      update.dailyFreeLimit = fields.dailyFreeLimit;
    await db.collection(COLLECTION).doc(id).set(update, { merge: true });
  } catch (err) {
    console.error("[apiMarketplaceFirestore] Failed to write override:", err);
    throw err;
  }
}
