/**
 * Client-side credit store (localStorage).
 * Resets included credits on the 1st of each month.
 * Simple conversion: 10 credits = $1 (easy mental math).
 */

const STORAGE_KEY = "vibetree-credits";

/** 10 credits per dollar — easy to compute (e.g. 100 credits = $10). */
export const CREDITS_PER_DOLLAR = 10;

/** Price per credit in USD for display (e.g. "1 credit = $0.10"). Single source of truth. */
export const PRICE_PER_CREDIT_USD = 1 / CREDITS_PER_DOLLAR;

/** Show "low on credits" banner and widget styling below this. ~1 session of messages (5–10) so users have time to buy. */
export const LOW_CREDIT_THRESHOLD = 10;

export interface CreditState {
  /** Current balance (included + purchased). */
  balance: number;
  /** Included credits per period (from plan). */
  includedPerPeriod: number;
  /** Period start date YYYY-MM (resets on 1st of month). */
  periodStart: string;
}

function getPeriodStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function loadState(): CreditState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CreditState;
  } catch {
    return null;
  }
}

function saveState(state: CreditState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Default included credits for Creator plan. */
const DEFAULT_INCLUDED = 50;

/**
 * Get current credit state, resetting balance to included amount if we're in a new month.
 */
export function getCreditState(): CreditState {
  const currentPeriod = getPeriodStart();
  const stored = loadState();
  if (!stored) {
    const initial: CreditState = {
      balance: DEFAULT_INCLUDED,
      includedPerPeriod: DEFAULT_INCLUDED,
      periodStart: currentPeriod,
    };
    saveState(initial);
    return initial;
  }
  if (stored.periodStart !== currentPeriod) {
    const reset: CreditState = {
      balance: stored.includedPerPeriod,
      includedPerPeriod: stored.includedPerPeriod,
      periodStart: currentPeriod,
    };
    saveState(reset);
    return reset;
  }
  return stored;
}

export function getBalance(): number {
  return getCreditState().balance;
}

/**
 * Deduct credits. Returns true if successful (balance was sufficient).
 */
export function deduct(amount: number): boolean {
  const state = getCreditState();
  if (state.balance < amount) return false;
  const next: CreditState = { ...state, balance: state.balance - amount };
  saveState(next);
  return true;
}

/**
 * Add credits (e.g. after purchase).
 */
export function add(amount: number): void {
  const state = getCreditState();
  const next: CreditState = { ...state, balance: state.balance + amount };
  saveState(next);
}

/**
 * Set balance to a specific value (for testing, e.g. simulate out of credits).
 * Clamps to 0 minimum. Does not change includedPerPeriod or periodStart.
 */
export function setBalance(amount: number): void {
  const state = getCreditState();
  const next: CreditState = { ...state, balance: Math.max(0, Math.floor(amount)) };
  saveState(next);
}

export function isLow(): boolean {
  return getBalance() < LOW_CREDIT_THRESHOLD;
}

export function hasCreditsForMessage(): boolean {
  return getBalance() >= 1;
}

/** Credit pack for purchase (simple math: 10 per $1). */
export interface CreditPack {
  id: string;
  credits: number;
  priceUsd: number;
  label: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "50", credits: 50, priceUsd: 5, label: "50 credits" },
  { id: "100", credits: 100, priceUsd: 10, label: "100 credits" },
  { id: "250", credits: 250, priceUsd: 25, label: "250 credits" },
  { id: "500", credits: 500, priceUsd: 50, label: "500 credits" },
];
