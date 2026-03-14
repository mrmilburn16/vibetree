import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { getClientIp } from "@/lib/adminAuth";
import { DEFAULT_CREDITS } from "@/lib/userCreditsFirestore";

const USERS_COLLECTION = "users";
const USER_CREDITS_COLLECTION = "user_credits";
/** Window for the per-IP signup rate limit. */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Run IP-based signup checks for a brand-new user (one who has no user_credits doc yet).
 *
 * Check 1 — rate limit: if any existing user signed up from this IP within the last
 *   60 minutes, delete the just-created Firebase Auth account and return a 429.
 * Check 2 — duplicate IP: if any existing user ever signed up from this IP, set
 *   starting credits to 0 instead of DEFAULT_CREDITS (silently, no error shown).
 *
 * On success (or when Firestore is unavailable), writes signupIp + signupTimestamp
 * to users/{uid} and eagerly initialises user_credits/{uid} with the determined balance.
 *
 * Returns null on success, or a NextResponse to return immediately on rejection.
 */
async function handleNewUserSignup(
  adminAuth: ReturnType<typeof getAdminAuth>,
  uid: string,
  ip: string,
): Promise<NextResponse | null> {
  let db;
  try {
    db = getAdminDb();
  } catch {
    // Firestore unavailable — skip IP checks, let credits lazy-init with defaults.
    console.warn("[auth/session] Firestore unavailable during signup; skipping IP checks for uid:", uid);
    return null;
  }

  const now = Date.now();

  if (ip !== "unknown") {
    // Single query for all docs sharing this signupIp (no composite index required).
    const ipDocs = await db
      .collection(USERS_COLLECTION)
      .where("signupIp", "==", ip)
      .get()
      .catch(() => null);

    if (ipDocs !== null && !ipDocs.empty) {
      const sixtyMinutesAgo = now - RATE_LIMIT_WINDOW_MS;
      const recentDoc = ipDocs.docs.find(
        (d) => typeof d.data().signupTimestamp === "number" && d.data().signupTimestamp >= sixtyMinutesAgo
      );

      // Check 1: signup rate limit — another account from this IP within 60 min.
      if (recentDoc) {
        console.warn(
          `[auth/session] Signup rate limit hit — IP: ${ip}, new uid: ${uid}, ` +
          `existing uid: ${recentDoc.id} (${Math.round((now - recentDoc.data().signupTimestamp) / 60000)} min ago). ` +
          `Deleting Firebase Auth account.`
        );
        // Delete the just-created Firebase Auth account so the email is freed.
        await adminAuth.deleteUser(uid).catch((e) =>
          console.warn("[auth/session] Failed to delete Firebase user after 429:", e)
        );
        return NextResponse.json({ error: "Please try again later." }, { status: 429 });
      }

      // Check 2: duplicate IP — a different account exists from this IP.
      const existingDoc = ipDocs.docs[0];
      console.warn(
        `[auth/session] Duplicate signup IP: ${ip}, new uid: ${uid}, ` +
        `existing uid: ${existingDoc.id}. Starting credits set to 0.`
      );

      await Promise.all([
        db.collection(USERS_COLLECTION).doc(uid).set(
          { signupIp: ip, signupTimestamp: now },
          { merge: true }
        ),
        db.collection(USER_CREDITS_COLLECTION).doc(uid).set({ balance: 0, updatedAt: now }),
      ]).catch((e) => console.warn("[auth/session] Failed to write user docs (dup IP path):", e));

      return null;
    }
  }

  // No IP conflicts — grant default credits and record signup metadata.
  await Promise.all([
    db.collection(USERS_COLLECTION).doc(uid).set(
      { signupIp: ip, signupTimestamp: now },
      { merge: true }
    ),
    db.collection(USER_CREDITS_COLLECTION).doc(uid).set({ balance: DEFAULT_CREDITS, updatedAt: now }),
  ]).catch((e) => console.warn("[auth/session] Failed to write user docs (clean signup path):", e));

  return null;
}

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
 * For new users (no existing user_credits doc) also runs IP-based signup checks.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const idToken = typeof body?.idToken === "string" ? body.idToken.trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  let adminAuth;
  try {
    adminAuth = getAdminAuth();
  } catch (e) {
    console.warn("[auth/session] Firebase Admin not configured:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const ip = getClientIp(request) ?? "unknown";

    // Determine if this is a brand-new user by checking whether their credits doc
    // already exists. Returning users and pre-existing accounts skip the IP checks.
    let isNewUser = false;
    try {
      const db = getAdminDb();
      const creditsSnap = await db.collection(USER_CREDITS_COLLECTION).doc(uid).get();
      isNewUser = !creditsSnap.exists;
    } catch {
      // Firestore read failure — conservatively treat as returning user to avoid
      // blocking legitimate logins.
    }

    if (isNewUser) {
      const rejection = await handleNewUserSignup(adminAuth, uid, ip);
      if (rejection) return rejection;
    }

    const response = NextResponse.json({
      user: { uid, email: decoded.email ?? null },
    });
    response.cookies.set(SESSION_COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    console.log("[auth/session] Session cookie set for uid:", uid, isNewUser ? "(new user)" : "(returning user)");
    return response;
  } catch (e) {
    console.warn("[auth/session] Invalid token:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
