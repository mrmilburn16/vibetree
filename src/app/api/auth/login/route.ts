import { NextResponse } from "next/server";

/**
 * POST /api/auth/login
 * Stub auth for the iOS companion app. Accepts any email/password and
 * returns a placeholder token so the app can proceed. Replace with real
 * auth (e.g. NextAuth, your own user store) when ready.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  // Demo: accept any credentials and return a placeholder token.
  // In production, validate against your user store and issue a real JWT/session.
  const token = `demo_${Buffer.from(`${email}:${Date.now()}`).toString("base64")}`;

  return NextResponse.json({
    token,
    email,
  });
}
