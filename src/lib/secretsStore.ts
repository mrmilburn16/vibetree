/**
 * Persistence for user secrets. Values are stored already encrypted (encrypted + iv).
 * One JSON file per user under .vibetree-cache/secrets/<safeUserId>.json.
 */

import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".vibetree-cache", "secrets");

export interface StoredSecret {
  encrypted: string;
  iv: string;
}

function safeUserId(userId: string): string {
  const hash = Buffer.from(userId, "utf8").toString("base64url").replace(/=/g, "");
  return hash.slice(0, 64) || "default";
}

function userPath(userId: string): string {
  return path.join(CACHE_DIR, `${safeUserId(userId)}.json`);
}

function ensureCacheDir(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}

function readUserSecrets(userId: string): Record<string, StoredSecret> {
  try {
    const p = userPath(userId);
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, StoredSecret> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "encrypted" in v && "iv" in v && typeof (v as StoredSecret).encrypted === "string" && typeof (v as StoredSecret).iv === "string") {
        out[k] = v as StoredSecret;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeUserSecrets(userId: string, secrets: Record<string, StoredSecret>): void {
  try {
    ensureCacheDir();
    fs.writeFileSync(userPath(userId), JSON.stringify(secrets), "utf-8");
  } catch {
    // ignore
  }
}

export function getStoredSecrets(userId: string): Record<string, StoredSecret> {
  return readUserSecrets(userId);
}

export function setStoredSecret(userId: string, key: string, encrypted: string, iv: string): void {
  const secrets = readUserSecrets(userId);
  secrets[key] = { encrypted, iv };
  writeUserSecrets(userId, secrets);
}

export function deleteStoredSecret(userId: string, key: string): boolean {
  const secrets = readUserSecrets(userId);
  if (!(key in secrets)) return false;
  delete secrets[key];
  writeUserSecrets(userId, secrets);
  return true;
}
