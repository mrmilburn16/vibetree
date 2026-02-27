/**
 * Server-side credit store.
 *
 * Uses Firestore when Firebase env vars are set, otherwise falls back to an
 * in-memory Map (safe for dev / mock mode). When Firebase Auth is added, swap
 * the `userId` source from session email to the Firebase UID.
 *
 * Firestore collection: `credits/{userId}`
 * Document fields:      balance, includedPerPeriod, periodStart, updatedAt
 */

import { getAdminDb } from "@/lib/firebaseAdmin";

const COLLECTION = "credits";
const DEFAULT_INCLUDED = 50;

export interface CreditRecord {
  balance: number;
  includedPerPeriod: number;
  /** YYYY-MM string. Credits reset on new period. */
  periodStart: string;
  updatedAt: number;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function freshRecord(): CreditRecord {
  return {
    balance: DEFAULT_INCLUDED,
    includedPerPeriod: DEFAULT_INCLUDED,
    periodStart: currentPeriod(),
    updatedAt: Date.now(),
  };
}

function maybeResetPeriod(rec: CreditRecord): CreditRecord {
  const period = currentPeriod();
  if (rec.periodStart !== period) {
    return {
      balance: rec.includedPerPeriod,
      includedPerPeriod: rec.includedPerPeriod,
      periodStart: period,
      updatedAt: Date.now(),
    };
  }
  return rec;
}

// ── In-memory fallback ──────────────────────────────────────────

const memStore = new Map<string, CreditRecord>();

// ── Firestore helpers ───────────────────────────────────────────

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────

export async function getCredits(userId: string): Promise<CreditRecord> {
  const db = getDb();

  if (db) {
    const doc = await db.collection(COLLECTION).doc(userId).get();
    if (doc.exists) {
      const raw = doc.data() as CreditRecord;
      const rec = maybeResetPeriod(raw);
      if (rec !== raw) {
        await db.collection(COLLECTION).doc(userId).set(rec);
      }
      return rec;
    }
    const rec = freshRecord();
    await db.collection(COLLECTION).doc(userId).set(rec);
    return rec;
  }

  // In-memory fallback
  let rec = memStore.get(userId);
  if (!rec) {
    rec = freshRecord();
    memStore.set(userId, rec);
    return rec;
  }
  const reset = maybeResetPeriod(rec);
  if (reset !== rec) {
    memStore.set(userId, reset);
  }
  return reset;
}

export async function deductCredits(
  userId: string,
  amount: number
): Promise<{ ok: boolean; balance: number }> {
  const rec = await getCredits(userId);
  if (rec.balance < amount) {
    return { ok: false, balance: rec.balance };
  }

  const updated: CreditRecord = {
    ...rec,
    balance: rec.balance - amount,
    updatedAt: Date.now(),
  };

  const db = getDb();
  if (db) {
    await db.collection(COLLECTION).doc(userId).set(updated);
  } else {
    memStore.set(userId, updated);
  }

  return { ok: true, balance: updated.balance };
}

export async function addCredits(
  userId: string,
  amount: number
): Promise<{ balance: number }> {
  const rec = await getCredits(userId);
  const updated: CreditRecord = {
    ...rec,
    balance: rec.balance + amount,
    updatedAt: Date.now(),
  };

  const db = getDb();
  if (db) {
    await db.collection(COLLECTION).doc(userId).set(updated);
  } else {
    memStore.set(userId, updated);
  }

  return { balance: updated.balance };
}

export async function setCreditsBalance(
  userId: string,
  amount: number
): Promise<{ balance: number }> {
  const rec = await getCredits(userId);
  const updated: CreditRecord = {
    ...rec,
    balance: Math.max(0, Math.floor(amount)),
    updatedAt: Date.now(),
  };

  const db = getDb();
  if (db) {
    await db.collection(COLLECTION).doc(userId).set(updated);
  } else {
    memStore.set(userId, updated);
  }

  return { balance: updated.balance };
}
