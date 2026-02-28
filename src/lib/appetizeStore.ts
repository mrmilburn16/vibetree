/**
 * In-memory store for Appetize public keys per project.
 * Used so the preview pane can show an interactive Appetize embed when available.
 */
const g = globalThis as unknown as { __appetizeStore?: Map<string, string> };
if (!g.__appetizeStore) g.__appetizeStore = new Map();
const store = g.__appetizeStore;

export function setAppetizePublicKey(projectId: string, publicKey: string): void {
  store.set(projectId, publicKey);
}

export function getAppetizePublicKey(projectId: string): string | undefined {
  return store.get(projectId);
}
