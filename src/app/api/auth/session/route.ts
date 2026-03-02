import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth";
import { getAdminAuth } from "@/lib/firebaseAdmin";

/**
 * GET /api/auth/session
 * Returns the current user if the session cookie is valid.
 */
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({});
  }
  return NextResponse.json({ user: { uid: user.uid, email: user.email } });
}

/**
 * POST /api/auth/session
 * Body: { idToken: string } (Firebase ID token from client).
 * Verifies the token and sets an httpOnly session cookie.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const idToken = typeof body?.idToken === "string" ? body.idToken.trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const response = NextResponse.json({
      user: { uid: decoded.uid, email: decoded.email ?? null },
    });
    response.cookies.set(SESSION_COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
