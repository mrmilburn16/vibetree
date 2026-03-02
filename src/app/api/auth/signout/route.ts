import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/auth/signout
 * Clears the session cookie.
 */
export async function POST() {
  const response = NextResponse.json({});
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
