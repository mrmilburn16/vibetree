import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { loginUser } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Authenticate with email and password, returns a JWT token.
 */
export async function POST(request: Request) {
  const limited = applyRateLimit(request, RATE_LIMITS.auth);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  if (!password) {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  try {
    const { token, user } = await loginUser(email, password);
    return NextResponse.json({ token, email: user.email, name: user.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
