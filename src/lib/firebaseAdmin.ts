import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App;
let db: Firestore;

function ensureApp(): App {
  if (app) return app;
  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
          "Missing Firebase Admin env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.local"
        );
      }

      app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
      console.log("[firebaseAdmin] Firebase Admin initialized successfully");
    } else {
      app = getApps()[0] as App;
    }
    return app;
  } catch (err) {
    console.error("[firebaseAdmin] Firebase Admin initialization failed:", err);
    throw err;
  }
}

export function getAdminDb(): Firestore {
  if (db) return db;
  const a = ensureApp();
  db = getFirestore(a);
  return db;
}

export function getAdminAuth(): Auth {
  ensureApp();
  return getAuth();
}

export type WaitlistEntry = {
  token: string;
  email: string;
  name: string;
  referralCode: string;
  referredBy: string | null;
  position: number;
  points: number;
  completedActions: string[];
  abVariant: "a" | "b";
  createdAt: FirebaseFirestore.Timestamp;
};
