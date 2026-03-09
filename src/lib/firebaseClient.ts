"use client";

/**
 * Firebase is loaded only on the client via dynamic import so that importing
 * this module from dashboard/layout never runs firebase/app in Node (which can crash SSR).
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let authInstance: import("firebase/auth").Auth | null = null;
let initPromise: Promise<import("firebase/auth").Auth | null> | null = null;

export function getFirebaseAuth(): import("firebase/auth").Auth | null {
  if (typeof window === "undefined") return null;
  if (authInstance) return authInstance;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { initializeApp, getApps } = await import("firebase/app");
        const { getAuth } = await import("firebase/auth");
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        authInstance = getAuth(app as import("firebase/app").FirebaseApp);
        return authInstance;
      } catch (e) {
        console.warn("[firebaseClient] init failed:", e);
        return null;
      }
    })();
  }
  return null;
}

/**
 * Call this when you need Auth and can await (e.g. sign-out). Use getFirebaseAuth() for sync check.
 */
export async function getFirebaseAuthAsync(): Promise<import("firebase/auth").Auth | null> {
  if (typeof window === "undefined") return null;
  const sync = getFirebaseAuth();
  if (sync) return sync;
  if (initPromise) return initPromise;
  return null;
}
