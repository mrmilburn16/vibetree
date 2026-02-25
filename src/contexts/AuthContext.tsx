"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebaseClient";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  isConfigured: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const FALLBACK_VALUE: AuthContextValue = {
  user: null,
  loading: false,
  error: null,
  signUp: async () => {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.");
  },
  signIn: async () => {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.");
  },
  signOut: async () => {},
  getIdToken: async () => null,
  isConfigured: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [configured]);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign up failed";
      setError(msg);
      throw e;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign in failed";
      setError(msg);
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, [user]);

  const value: AuthContextValue = configured
    ? { user, loading, error, signUp, signIn, signOut, getIdToken, isConfigured: true }
    : { ...FALLBACK_VALUE, loading: false };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  return ctx ?? FALLBACK_VALUE;
}

export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
