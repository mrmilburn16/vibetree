"use client";

/**
 * Refreshes the session cookie with a new Firebase ID token.
 * Call this periodically during active use so the cookie stays valid (Firebase tokens expire in 1h).
 * Used by SessionRefresh component (every 50 min) and by Test Suite before long batch runs.
 */
export async function refreshSessionCookie(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { getFirebaseAuthAsync } = await import("@/lib/firebaseClient");
    const auth = await getFirebaseAuthAsync();
    if (!auth?.currentUser) return false;
    const idToken = await auth.currentUser.getIdToken(true);
    if (!idToken?.length) return false;
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
