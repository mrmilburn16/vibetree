/**
 * Server-side unified credit balance (app generation + AI proxy).
 * Collection: user_credits (doc id = userId). Field: balance (number).
 * New users get DEFAULT_CREDITS (10) on first access (lazy init on signup / first use).
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "user_credits";
export const DEFAULT_CREDITS = 10;

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

/** Get current credit balance. Creates doc with DEFAULT_CREDITS if missing (new user). */
export async function getCreditBalance(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const ref = db.collection(COLLECTION).doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ balance: DEFAULT_CREDITS, updatedAt: Date.now() });
      return DEFAULT_CREDITS;
    }
    const bal = snap.data()?.balance;
    return typeof bal === "number" && bal >= 0 ? bal : 0;
  } catch {
    return 0;
  }
}

export interface DeductCreditsResult {
  ok: boolean;
  balanceAfter?: number;
  error?: string;
}

/** Deduct credits. Returns ok: false if insufficient or DB error. */
export async function deductCredits(
  userId: string,
  amount: number
): Promise<DeductCreditsResult> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured" };
  }
  if (amount <= 0 || !Number.isFinite(amount)) {
    return { ok: false, error: "Invalid amount" };
  }
  try {
    const ref = db.collection(COLLECTION).doc(userId);
    const snap = await ref.get();
    let current: number;
    if (!snap.exists) {
      await ref.set({ balance: DEFAULT_CREDITS, updatedAt: Date.now() });
      current = DEFAULT_CREDITS;
    } else {
      const bal = snap.data()?.balance;
      current = typeof bal === "number" && bal >= 0 ? bal : 0;
    }
    if (current < amount) {
      return { ok: false, error: "Insufficient credits" };
    }
    const balanceAfter = current - amount;
    await ref.set({ balance: balanceAfter, updatedAt: Date.now() }, { merge: true });
    return { ok: true, balanceAfter };
  } catch (e) {
    console.error("[userCredits] deduct failed:", e);
    return { ok: false, error: "Deduction failed" };
  }
}

/** Set credit balance to a specific value (e.g. plan allowance on checkout or renewal). */
export async function setCreditBalance(userId: string, balance: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  if (!Number.isFinite(balance) || balance < 0) return;
  const ref = db.collection(COLLECTION).doc(userId);
  await ref.set({ balance, updatedAt: Date.now() }, { merge: true });
}

/** Add credits (e.g. after purchase). */
export async function addCredits(
  userId: string,
  amount: number
): Promise<{ ok: boolean; balanceAfter: number; error?: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, balanceAfter: 0, error: "Database not configured" };
  }
  if (amount <= 0 || !Number.isFinite(amount)) {
    return { ok: false, balanceAfter: 0, error: "Invalid amount" };
  }
  try {
    const ref = db.collection(COLLECTION).doc(userId);
    const snap = await ref.get();
    let current: number;
    if (!snap.exists) {
      await ref.set({ balance: DEFAULT_CREDITS, updatedAt: Date.now() });
      current = DEFAULT_CREDITS;
    } else {
      const bal = snap.data()?.balance;
      current = typeof bal === "number" && bal >= 0 ? bal : 0;
    }
    const balanceAfter = current + amount;
    await ref.set({ balance: balanceAfter, updatedAt: Date.now() }, { merge: true });
    return { ok: true, balanceAfter };
  } catch (e) {
    console.error("[userCredits] add failed:", e);
    return { ok: false, balanceAfter: 0, error: "Add failed" };
  }
}
