import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * POST /api/auth/forgot-password
 *
 * Stub for password reset. When Firebase Auth is integrated, call
 * `sendPasswordResetEmail()` from the Firebase Admin SDK here.
 *
 * Always returns 200 to avoid leaking whether an email exists.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`forgot:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (email) {
    // TODO: When Firebase Auth is added, call admin.auth().generatePasswordResetLink(email)
    // and send via Resend/SendGrid. For now, log the request.
    console.log(`[forgot-password] Reset requested for: ${email}`);
  }

  return NextResponse.json({ ok: true });
}
