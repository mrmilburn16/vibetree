import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

/**
 * POST /api/auth/login
 * Real Firebase Auth for the iOS companion app. Verifies email/password via
 * Firebase Identity Toolkit, then returns a custom token so the client can
 * sign in with Firebase Auth and get an ID token for API requests.
 */

const FIREBASE_AUTH_REST =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

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

  const apiKey =
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("[auth/login] FIREBASE_WEB_API_KEY or NEXT_PUBLIC_FIREBASE_API_KEY not set");
    return NextResponse.json(
      { error: "Server auth not configured" },
      { status: 503 }
    );
  }

  try {
    const auth = getAdminAuth();
    const user = await auth.getUserByEmail(email);
    if (!user?.uid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const res = await fetch(
      `${FIREBASE_AUTH_REST}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg =
        (err as { error?: { message?: string } })?.error?.message ?? "Invalid email or password";
      return NextResponse.json(
        { error: msg },
        { status: 401 }
      );
    }

    const customToken = await auth.createCustomToken(user.uid);

    return NextResponse.json({
      token: customToken,
      email: user.email ?? email,
      uid: user.uid,
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "auth/user-not-found") {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    console.error("[auth/login]", err?.message ?? e);
    return NextResponse.json(
      { error: "Sign in failed" },
      { status: 401 }
    );
  }
}
