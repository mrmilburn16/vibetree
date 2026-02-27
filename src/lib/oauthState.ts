/**
 * Short-lived OAuth state store for connect flows.
 * In-memory; for production with multiple instances, use Redis or similar.
 */

const stateStore = new Map<
  string,
  { projectId: string; userId?: string; codeVerifier?: string; provider: string }
>();

const TTL_MS = 15 * 60 * 1000; // 15 minutes
const cleanupInterval = 60 * 1000; // 1 min

let lastCleanup = Date.now();

function maybeCleanup() {
  if (Date.now() - lastCleanup < cleanupInterval) return;
  lastCleanup = Date.now();
  // We don't store expiry per entry for simplicity; just clear old entries periodically
  // For production, add createdAt to each entry and prune.
}

export function setOAuthState(
  state: string,
  data: { projectId: string; userId?: string; codeVerifier?: string; provider: string }
): void {
  maybeCleanup();
  stateStore.set(state, { ...data, provider: data.provider });
}

export function getOAuthState(state: string): {
  projectId: string;
  userId?: string;
  codeVerifier?: string;
  provider: string;
} | null {
  const entry = stateStore.get(state);
  if (!entry) return null;
  stateStore.delete(state); // one-time use
  return entry;
}
