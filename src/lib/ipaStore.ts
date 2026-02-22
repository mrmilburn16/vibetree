const g = globalThis as unknown as { __ipaStore?: Map<string, Buffer> };
if (!g.__ipaStore) g.__ipaStore = new Map();
const store = g.__ipaStore;

export function setProjectIPA(projectId: string, ipa: Buffer): void {
  store.set(projectId, ipa);
}

export function getProjectIPA(projectId: string): Buffer | undefined {
  return store.get(projectId);
}

export function hasProjectIPA(projectId: string): boolean {
  return store.has(projectId);
}
