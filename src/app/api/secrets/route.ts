/**
 * Secrets API: list (masked) and create/update/delete secrets.
 *
 * SECURITY - NEVER LOG:
 * - The raw secret value (request body or anywhere).
 * - The decrypted value (after decrypt()).
 * - The full masked string (e.g. "••••••••1234") in any logging middleware or error handler.
 * Log only key names, key counts, and high-level success/failure.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/secretsAuth";
import { encrypt, decrypt, isSecretsEncryptionConfigured } from "@/lib/secretsEncryption";
import {
  getStoredSecrets,
  setStoredSecret,
  deleteStoredSecret,
} from "@/lib/secretsStore";

const MASK_CHAR = "•";
const MASK_TAIL_LENGTH = 4;

function maskValue(plaintext: string): string {
  if (plaintext.length <= MASK_TAIL_LENGTH) return MASK_CHAR.repeat(plaintext.length);
  const tail = plaintext.slice(-MASK_TAIL_LENGTH);
  const maskLen = Math.max(plaintext.length - MASK_TAIL_LENGTH, 4);
  return MASK_CHAR.repeat(maskLen) + tail;
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSecretsEncryptionConfigured()) {
    return NextResponse.json(
      { error: "Secrets encryption not configured" },
      { status: 503 }
    );
  }

  const stored = getStoredSecrets(userId);
  const list: { key: string; maskedValue: string }[] = [];

  for (const [key, { encrypted, iv }] of Object.entries(stored)) {
    try {
      const decrypted = decrypt(encrypted, iv);
      list.push({ key, maskedValue: maskValue(decrypted) });
    } catch {
      list.push({ key, maskedValue: "••••••••????" });
    }
  }

  return NextResponse.json({ secrets: list });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSecretsEncryptionConfigured()) {
    return NextResponse.json(
      { error: "Secrets encryption not configured" },
      { status: 503 }
    );
  }

  let body: { key?: string; value?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const value = typeof body?.value === "string" ? body.value : "";

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  try {
    const { encrypted, iv } = encrypt(value);
    setStoredSecret(userId, key, encrypted, iv);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Encryption failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, key });
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key")?.trim() ?? "";

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const deleted = deleteStoredSecret(userId, key);
  return NextResponse.json({ ok: true, deleted });
}
