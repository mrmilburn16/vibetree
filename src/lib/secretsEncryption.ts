import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") {
    throw new Error("SECRETS_ENCRYPTION_KEY is not set");
  }
  const hex = raw.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error("SECRETS_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt plaintext with AES-256-GCM. Uses a unique IV per call.
 * Returns { encrypted: base64 ciphertext (with auth tag appended), iv: base64 IV }.
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([enc, tag]);
  return {
    encrypted: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt ciphertext (base64) with the given IV (base64).
 */
export function decrypt(encryptedBase64: string, ivBase64: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, "base64");
  const combined = Buffer.from(encryptedBase64, "base64");
  if (combined.length < AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted payload");
  }
  const enc = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const tag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final("utf8");
}

export function isSecretsEncryptionConfigured(): boolean {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") return false;
  const hex = raw.trim().toLowerCase().replace(/^0x/, "");
  return /^[0-9a-f]{64}$/.test(hex);
}
