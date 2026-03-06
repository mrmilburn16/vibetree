/**
 * Firestore persistence for user subscription status (Stripe).
 * Collection: users. Document ID: Firebase Auth uid.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";
import type { StripePlanId } from "@/lib/stripe";

const COLLECTION = "users";

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing" | "unpaid" | null;

export interface UserSubscriptionDoc {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planId: StripePlanId | "free" | null;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null;
  updatedAt: number;
}

export const DEFAULT_SUBSCRIPTION: UserSubscriptionDoc = {
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  planId: "free",
  status: null,
  currentPeriodEnd: null,
  updatedAt: 0,
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

export async function getSubscription(userId: string): Promise<UserSubscriptionDoc | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      stripeCustomerId: (data.stripeCustomerId as string) ?? null,
      stripeSubscriptionId: (data.stripeSubscriptionId as string) ?? null,
      planId: data.planId === "starter" || data.planId === "builder" || data.planId === "pro" ? data.planId : data.planId === "free" ? "free" : null,
      status: (data.subscriptionStatus as SubscriptionStatus) ?? null,
      currentPeriodEnd: typeof data.currentPeriodEnd === "number" ? data.currentPeriodEnd : null,
      updatedAt: typeof data.subscriptionUpdatedAt === "number" ? data.subscriptionUpdatedAt : 0,
    };
  } catch {
    return null;
  }
}

/** Dev/owner user IDs that bypass subscription checks (always treated as Pro). */
const OWNER_USER_ID_HARDCODED = "1eYArCMnOxeEsiFbS0nehKjWbuI2";

function getOwnerUserIds(): Set<string> {
  const ids = new Set<string>([OWNER_USER_ID_HARDCODED]);
  const env = process.env.OWNER_USER_IDS;
  if (typeof env === "string" && env.trim()) {
    env.split(",").forEach((id) => {
      const t = id.trim();
      if (t) ids.add(t);
    });
  }
  return ids;
}

/** Returns true if the user has an active (or trialing) paid subscription. Owner IDs bypass (see OWNER_USER_IDS). */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (getOwnerUserIds().has(userId)) return true;
  const sub = await getSubscription(userId);
  if (!sub) return false;
  if (sub.planId === "free" || !sub.planId) return false;
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < Date.now() / 1000) return false;
  return true;
}

const SUBSCRIPTION_TO_USER_COLLECTION = "subscription_to_user";

export async function setSubscriptionFromCheckout(
  userId: string,
  data: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    planId: StripePlanId;
    status: SubscriptionStatus;
    currentPeriodEnd: number;
  }
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const now = Date.now();
  try {
    await db.runTransaction(async (tx) => {
      tx.set(
        db.collection(COLLECTION).doc(userId),
        {
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          planId: data.planId,
          subscriptionStatus: data.status,
          currentPeriodEnd: data.currentPeriodEnd,
          subscriptionUpdatedAt: now,
        },
        { merge: true }
      );
      tx.set(db.collection(SUBSCRIPTION_TO_USER_COLLECTION).doc(data.stripeSubscriptionId), {
        userId,
        updatedAt: now,
      });
    });
  } catch (e) {
    console.error("[subscriptionFirestore] setSubscriptionFromCheckout failed:", e);
    throw e;
  }
}

export async function getUserIdBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(SUBSCRIPTION_TO_USER_COLLECTION).doc(subscriptionId).get();
    if (!snap.exists) return null;
    return (snap.data()?.userId as string) ?? null;
  } catch {
    return null;
  }
}

export async function setSubscriptionDeleted(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const now = Date.now();
  try {
    await db.collection(COLLECTION).doc(userId).set(
      {
        stripeSubscriptionId: null,
        planId: "free",
        subscriptionStatus: "canceled",
        currentPeriodEnd: null,
        subscriptionUpdatedAt: now,
      },
      { merge: true }
    );
  } catch (e) {
    console.error("[subscriptionFirestore] setSubscriptionDeleted failed:", e);
    throw e;
  }
}

export async function setSubscriptionDeletedBySubscriptionId(
  subscriptionId: string
): Promise<boolean> {
  const userId = await getUserIdBySubscriptionId(subscriptionId);
  if (!userId) return false;
  await setSubscriptionDeleted(userId);
  const db = getDb();
  if (db) {
    try {
      await db.collection(SUBSCRIPTION_TO_USER_COLLECTION).doc(subscriptionId).delete();
    } catch {
      // best-effort
    }
  }
  return true;
}
