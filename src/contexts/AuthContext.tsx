"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getFirebaseAuth, isFirebaseAuthEnabled } from "@/lib/firebase";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";

export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** True if using real Firebase Auth (vs mock localStorage). */
  isRealAuth: boolean;
  /** Call after mock sign-in to refresh user state. No-op when isRealAuth. */
  refreshMockUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_SESSION_KEY = "vibetree-session";

function getMockUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MOCK_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { email?: string; at?: number };
    if (!data?.email) return null;
    return {
      uid: `mock_${data.email}`,
      email: data.email,
      emailVerified: false,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isRealAuth = isFirebaseAuthEnabled();

  const signOut = useCallback(async () => {
    if (isRealAuth) {
      const auth = getFirebaseAuth();
      if (auth) await fbSignOut(auth);
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem(MOCK_SESSION_KEY);
    }
    setUser(null);
  }, [isRealAuth]);

  useEffect(() => {
    if (isRealAuth) {
      const auth = getFirebaseAuth();
      if (!auth) {
        setUser(getMockUser());
        setLoading(false);
        return;
      }
      const unsub = onAuthStateChanged(auth, (fbUser: User | null) => {
        if (fbUser) {
          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? null,
            emailVerified: fbUser.emailVerified ?? false,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsub();
    } else {
      setUser(getMockUser());
      setLoading(false);
    }
  }, [isRealAuth]);

  const refreshMockUser = useCallback(() => {
    if (!isRealAuth) setUser(getMockUser());
  }, [isRealAuth]);

  const value: AuthContextValue = {
    user,
    loading,
    signOut,
    isRealAuth,
    refreshMockUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      loading: false,
      signOut: async () => {},
      isRealAuth: false,
      refreshMockUser: () => {},
    };
  }
  return ctx;
}
