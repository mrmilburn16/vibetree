import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { registerUser, loginUser } from "@/lib/auth";

/**
 * POST /api/auth/register
 * Create a new account and return a JWT token.
 */
export async function POST(request: Request) {
  const limited = applyRateLimit(request, RATE_LIMITS.auth);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  try {
    await registerUser(email, password, name);
    const { token, user } = await loginUser(email, password);
    return NextResponse.json(
      { token, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
