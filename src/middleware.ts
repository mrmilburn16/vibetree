import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return null;
}

function isAllowedIp(request: NextRequest): boolean {
  const allowed = process.env.ADMIN_ALLOWED_IPS;
  if (!allowed) return true; // dev: no list = allow all
  const ip = getClientIp(request);
  if (!ip) return false;
  const list = allowed.split(",").map((s) => s.trim());
  return list.includes(ip);
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Admin IP guard
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (!isAllowedIp(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // A/B variant cookie for /waitlist
  if (path === "/waitlist" || path.startsWith("/waitlist/")) {
    const response = NextResponse.next();
    if (!request.cookies.has("ab_variant")) {
      const variant = Math.random() < 0.5 ? "a" : "b";
      response.cookies.set("ab_variant", variant, {
        httpOnly: false, // readable by client JS
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 90, // 90 days
        path: "/",
      });
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/waitlist", "/waitlist/:path*"],
};
