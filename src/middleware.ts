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

const SESSION_COOKIE_NAME = "vibetree-session";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Inspect cookies: Edge may receive them differently than Node (e.g. Cookie header vs request.cookies)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  let hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const allCookieNames = request.cookies.getAll().map((c) => c.name);

  // Fallback: Edge sometimes parses cookies differently; if Cookie header has the session but request.cookies doesn't, treat as authenticated
  const cookieHeaderHasSession = cookieHeader.includes(`${SESSION_COOKIE_NAME}=`);
  if (cookieHeaderHasSession && !hasSession) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[middleware] Cookie header has vibetree-session but request.cookies.has() is false — using header as fallback (Edge cookie quirk)");
    }
    hasSession = true;
  }

  if (
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/editor" ||
    path.startsWith("/editor/") ||
    path === "/credits"
  ) {
    if (process.env.NODE_ENV === "development") {
      const sessionValue = sessionCookie?.value;
      const valuePreview = sessionValue
        ? `${sessionValue.length} chars, starts ${sessionValue.slice(0, 12)}...`
        : "missing";
      console.log("[middleware] protected route", {
        path,
        hasSession: !!hasSession,
        condition: `hasSession=${hasSession} → ${hasSession ? "allow" : "redirect"}`,
        cookieNames: allCookieNames,
        sessionCookie: sessionCookie ? { name: sessionCookie.name, valuePreview } : null,
        cookieHeaderPresent: cookieHeader.length > 0,
        cookieHeaderLength: cookieHeader.length,
      });
    }
    if (!hasSession) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  // Do NOT redirect /sign-in → /dashboard here. Cookie presence does not mean the token is valid
  // (e.g. expired or invalid token still sends the cookie). Redirecting causes a loop: sign-in
  // (cookie exists) → dashboard → server rejects token → client redirects to sign-in → repeat.
  // The sign-in page itself checks GET /api/auth/session and redirects to dashboard only when
  // the session is actually valid.

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
  matcher: [
    "/sign-in",
    "/dashboard",
    "/dashboard/:path*",
    "/editor",
    "/editor/:path*",
    "/credits",
    "/admin/:path*",
    "/api/admin/:path*",
    "/waitlist",
    "/waitlist/:path*",
  ],
};
