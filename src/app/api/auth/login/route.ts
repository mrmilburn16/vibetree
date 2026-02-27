import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * POST /api/auth/login
 * Stub auth for the iOS companion app. Accepts any email/password and
 * returns a placeholder token so the app can proceed. Replace with real
 * auth (e.g. Firebase Auth) when ready.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = rateLimit(`auth:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  const token = `demo_${Buffer.from(`${email}:${Date.now()}`).toString("base64")}`;

  return NextResponse.json({
    token,
    email,
  });
}
