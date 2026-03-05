/**
 * Simulator wallet persistence in Firestore.
 * Collection: simulator_wallets (doc id = userId).
 * Balance stored in cents to avoid float issues. $0.20/min = 20 cents/min.
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "simulator_wallets";
const TRANSACTIONS_SUB = "transactions";

const RATE_CENTS_PER_MINUTE = 20; // $0.20/min

export type PlanId = "free" | "starter" | "builder" | "pro";

export interface SimulatorWalletDoc {
  balanceCents: number;
  updatedAt: number;
  planId?: PlanId;
}

export interface SimulatorTransactionDoc {
  date: number;
  type: "topup" | "deduction";
  amountCents: number;
  balanceAfterCents: number;
}

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

/** Get wallet and plan for a user. Defaults balance 0, planId 'free' if doc missing. */
export async function getWallet(userId: string): Promise<SimulatorWalletDoc> {
  const db = getDb();
  if (!db) {
    return { balanceCents: 0, updatedAt: Date.now(), planId: "free" };
  }
  try {
    const snap = await db.collection(COLLECTION).doc(userId).get();
    if (!snap.exists) {
      return { balanceCents: 0, updatedAt: Date.now(), planId: "free" };
    }
    const d = snap.data()!;
    return {
      balanceCents: typeof d.balanceCents === "number" ? d.balanceCents : 0,
      updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
      planId: typeof d.planId === "string" ? (d.planId as PlanId) : "free",
    };
  } catch {
    return { balanceCents: 0, updatedAt: Date.now(), planId: "free" };
  }
}

/** List recent transactions (newest first). */
export async function listTransactions(
  userId: string,
  limit: number = 50
): Promise<SimulatorTransactionDoc[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection(COLLECTION)
      .doc(userId)
      .collection(TRANSACTIONS_SUB)
      .orderBy("date", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        date: typeof d.date === "number" ? d.date : 0,
        type: d.type === "topup" || d.type === "deduction" ? d.type : "topup",
        amountCents: typeof d.amountCents === "number" ? d.amountCents : 0,
        balanceAfterCents: typeof d.balanceAfterCents === "number" ? d.balanceAfterCents : 0,
      };
    });
  } catch {
    return [];
  }
}

/** Top up wallet (mock success). Creates doc if missing. */
export async function topUp(
  userId: string,
  amountCents: number
): Promise<{ ok: boolean; balanceCents: number; error?: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, balanceCents: 0, error: "Database not configured" };
  }
  const allowed = [500, 1000, 2500]; // $5, $10, $25
  if (!allowed.includes(amountCents)) {
    return { ok: false, balanceCents: 0, error: "Invalid amount. Use $5, $10, or $25." };
  }
  try {
    const ref = db.collection(COLLECTION).doc(userId);
    const snap = await ref.get();
    const now = Date.now();
    const current = snap.exists && typeof (snap.data()?.balanceCents) === "number"
      ? (snap.data()!.balanceCents as number)
      : 0;
    const balanceAfterCents = current + amountCents;
    await ref.set({
      balanceCents: balanceAfterCents,
      updatedAt: now,
    }, { merge: true });
    const txRef = ref.collection(TRANSACTIONS_SUB).doc();
    await txRef.set({
      date: now,
      type: "topup",
      amountCents,
      balanceAfterCents,
    });
    return { ok: true, balanceCents: balanceAfterCents };
  } catch (e) {
    console.error("[simulator-wallet] topUp failed:", e);
    return { ok: false, balanceCents: 0, error: "Top-up failed" };
  }
}

/** Deduct from wallet (e.g. for simulator session). Returns new balance or error. */
export async function deduct(
  userId: string,
  amountCents: number
): Promise<{ ok: boolean; balanceCents: number; error?: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, balanceCents: 0, error: "Database not configured" };
  }
  if (amountCents <= 0) {
    return { ok: false, balanceCents: 0, error: "Invalid amount" };
  }
  try {
    const ref = db.collection(COLLECTION).doc(userId);
    const snap = await ref.get();
    const current = snap.exists && typeof (snap.data()?.balanceCents) === "number"
      ? (snap.data()!.balanceCents as number)
      : 0;
    const deductAmount = Math.min(amountCents, current);
    const balanceAfterCents = current - deductAmount;
    const now = Date.now();
    await ref.set({
      balanceCents: balanceAfterCents,
      updatedAt: now,
    }, { merge: true });
    if (deductAmount > 0) {
      const txRef = ref.collection(TRANSACTIONS_SUB).doc();
      await txRef.set({
        date: now,
        type: "deduction",
        amountCents: deductAmount,
        balanceAfterCents,
      });
    }
    return { ok: true, balanceCents: balanceAfterCents };
  } catch (e) {
    console.error("[simulator-wallet] deduct failed:", e);
    return { ok: false, balanceCents: 0, error: "Deduction failed" };
  }
}

export { RATE_CENTS_PER_MINUTE };
