/**
 * Fetch a single secret's raw value (decrypted). Used by the generated iOS app at runtime.
 * Only returns the value when the request is authenticated and the secret belongs to that user.
 *
 * SECURITY - NEVER LOG:
 * - The raw secret value, the decrypted value, or the full masked string.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/secretsAuth";
import { decrypt, isSecretsEncryptionConfigured } from "@/lib/secretsEncryption";
import { getStoredSecrets } from "@/lib/secretsStore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
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

  const { key } = await params;
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const stored = getStoredSecrets(userId);
  const entry = stored[key];
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const value = decrypt(entry.encrypted, entry.iv);
    return NextResponse.json({ value });
  } catch {
    return NextResponse.json({ error: "Decryption failed" }, { status: 500 });
  }
}
