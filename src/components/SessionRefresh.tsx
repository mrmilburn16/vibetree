"use client";

import { useEffect, useRef } from "react";
import { getFirebaseAuthAsync } from "@/lib/firebaseClient";
import { refreshSessionCookie } from "@/lib/sessionRefresh";

/** Interval between session cookie refreshes (Firebase ID tokens expire in 1h). */
const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes

/**
 * When the user is signed in (Firebase auth), periodically refresh the session cookie
 * so long-running use (e.g. Test Suite batch) doesn't hit 401 mid-run.
 * Renders nothing.
 */
export function SessionRefresh() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const scheduleRefresh = () => {
      const doRefresh = () => {
        refreshSessionCookie().catch(() => {});
      };
      doRefresh();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS);
    };

    getFirebaseAuthAsync().then((auth) => {
      if (!auth || !mounted) return;
      unsubscribe = auth.onAuthStateChanged((user) => {
        if (!mounted) return;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (user) scheduleRefresh();
      });
    });

    return () => {
      mounted = false;
      unsubscribe?.();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return null;
}
