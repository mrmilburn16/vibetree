/**
 * Server-wide daily rate limiter for Alpha Vantage free tier.
 * Free tier cap: 25 requests/day across all endpoints.
 * Counter resets at midnight server time.
 */

const DAILY_LIMIT = 25;

let count = 0;
let resetDate = new Date().toDateString();

function maybeReset() {
  const today = new Date().toDateString();
  if (today !== resetDate) {
    count = 0;
    resetDate = today;
  }
}

export function getRemainingCalls(): number {
  maybeReset();
  return Math.max(0, DAILY_LIMIT - count);
}

export function consumeCall(): boolean {
  maybeReset();
  if (count >= DAILY_LIMIT) return false;
  count++;
  return true;
}
